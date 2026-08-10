import { superuserPb } from "./pb/superuser";
import { processImage } from "./watermark";
import { r2Upload, r2Download, BUCKET_PUBLIC, BUCKET_PRIVATE } from "./r2";

/**
 * O id do REGISTRO (gerado pelo PocketBase, 15 chars) e o id do OBJETO no R2
 * são coisas separadas. As chaves do R2 são escolhidas aqui e guardadas no
 * registro — nada depende de os dois coincidirem.
 */
export const newObjectId = (): string => crypto.randomUUID();

export const keysFor = (galleryId: string, objectId: string) => ({
  previewKey: `${galleryId}/${objectId}.webp`,
  thumbKey: `${galleryId}/${objectId}_t.webp`,
  originalKey: `${galleryId}/${objectId}_orig`,
});

export interface StorePhotoOpts {
  galleryId: string;
  buffer: Buffer;
  contentType: string;
  position: number;
  watermarkText: string;
  driveFileId?: string | null;
  filename?: string | null;
}

export interface StoredPhoto {
  mediaId: string;
  previewKey: string;
  thumbKey: string;
}

/**
 * Aplica marca d'água, sobe preview/thumb (públicos) + original (privado) e
 * insere o registro em `media_items`. Lança erro em falha.
 */
export async function storePhoto(opts: StorePhotoOpts): Promise<StoredPhoto> {
  const {
    galleryId,
    buffer,
    contentType,
    position,
    watermarkText,
    driveFileId,
    filename,
  } = opts;

  const { preview, thumb, width, height } = await processImage(buffer, {
    text: watermarkText,
  });

  const { previewKey, thumbKey, originalKey } = keysFor(galleryId, newObjectId());

  await Promise.all([
    r2Upload(BUCKET_PUBLIC, previewKey, preview, "image/webp"),
    r2Upload(BUCKET_PUBLIC, thumbKey, thumb, "image/webp"),
    r2Upload(
      BUCKET_PRIVATE,
      originalKey,
      buffer,
      contentType || "application/octet-stream",
    ),
  ]);

  const pb = await superuserPb();
  const rec = await pb.collection("media_items").create<{ id: string }>({
    gallery: galleryId,
    type: "photo",
    drive_file_id: driveFileId ?? "",
    filename: filename ?? "",
    preview_key: previewKey,
    thumb_key: thumbKey,
    original_key: originalKey,
    width,
    height,
    status: "ready",
    position,
  });

  return { mediaId: rec.id, previewKey, thumbKey };
}

export interface StorePhotoFromKeyOpts {
  galleryId: string;
  /** Id do objeto no R2 (o mesmo usado para montar `originalKey` no presign). */
  objectId: string;
  originalKey: string;
  position: number;
  watermarkText: string;
  filename?: string | null;
}

/**
 * Versão do `storePhoto` para upload presigned: o original já está no R2
 * privado, então só baixa, gera preview/thumb com marca d'água e registra.
 */
export async function storePhotoFromR2Key(
  opts: StorePhotoFromKeyOpts,
): Promise<StoredPhoto> {
  const { galleryId, objectId, originalKey, position, watermarkText, filename } =
    opts;

  const buffer = await r2Download(BUCKET_PRIVATE, originalKey);
  const { preview, thumb, width, height } = await processImage(buffer, {
    text: watermarkText,
  });

  const { previewKey, thumbKey } = keysFor(galleryId, objectId);

  await Promise.all([
    r2Upload(BUCKET_PUBLIC, previewKey, preview, "image/webp"),
    r2Upload(BUCKET_PUBLIC, thumbKey, thumb, "image/webp"),
  ]);

  const pb = await superuserPb();
  const rec = await pb.collection("media_items").create<{ id: string }>({
    gallery: galleryId,
    type: "photo",
    filename: filename ?? "",
    preview_key: previewKey,
    thumb_key: thumbKey,
    original_key: originalKey,
    width,
    height,
    status: "ready",
    position,
  });

  return { mediaId: rec.id, previewKey, thumbKey };
}
