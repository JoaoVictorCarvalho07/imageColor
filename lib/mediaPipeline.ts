import type { SupabaseClient } from "@supabase/supabase-js";
import { processImage } from "./watermark";
import { r2Upload, r2Download, BUCKET_PUBLIC, BUCKET_PRIVATE } from "./r2";

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

/** Aplica marca d'água, sobe preview/thumb (públicos) + original (privado) e
 * insere a linha em media_items. Lança erro em falha. */
export async function storePhoto(
  supabase: SupabaseClient,
  opts: StorePhotoOpts,
): Promise<StoredPhoto> {
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

  const mediaId = crypto.randomUUID();
  const previewKey = `${galleryId}/${mediaId}.webp`;
  const thumbKey = `${galleryId}/${mediaId}_t.webp`;
  const origKey = `${galleryId}/${mediaId}_orig`;

  await Promise.all([
    r2Upload(BUCKET_PUBLIC, previewKey, preview, "image/webp"),
    r2Upload(BUCKET_PUBLIC, thumbKey, thumb, "image/webp"),
    r2Upload(BUCKET_PRIVATE, origKey, buffer, contentType || "application/octet-stream"),
  ]);

  const { error } = await supabase.from("media_items").insert({
    id: mediaId,
    gallery_id: galleryId,
    type: "photo",
    drive_file_id: driveFileId ?? null,
    filename: filename ?? null,
    preview_key: previewKey,
    thumb_key: thumbKey,
    original_key: origKey,
    width,
    height,
    status: "ready",
    position,
  });
  if (error) throw new Error(error.message);

  return { mediaId, previewKey, thumbKey };
}

export interface StorePhotoFromKeyOpts {
  galleryId: string;
  mediaId: string;
  originalKey: string;
  contentType: string;
  position: number;
  watermarkText: string;
  filename?: string | null;
}

/**
 * Versão do storePhoto para upload presigned: o original já está no R2 privado,
 * só baixa, gera preview/thumb com marca d'água e insere em media_items.
 */
export async function storePhotoFromR2Key(
  supabase: SupabaseClient,
  opts: StorePhotoFromKeyOpts,
): Promise<StoredPhoto> {
  const { galleryId, mediaId, originalKey, contentType, position, watermarkText, filename } = opts;

  const buffer = await r2Download(BUCKET_PRIVATE, originalKey);
  const { preview, thumb, width, height } = await processImage(buffer, { text: watermarkText });

  const previewKey = `${galleryId}/${mediaId}.webp`;
  const thumbKey = `${galleryId}/${mediaId}_t.webp`;

  await Promise.all([
    r2Upload(BUCKET_PUBLIC, previewKey, preview, "image/webp"),
    r2Upload(BUCKET_PUBLIC, thumbKey, thumb, "image/webp"),
  ]);

  const { error } = await supabase.from("media_items").insert({
    id: mediaId,
    gallery_id: galleryId,
    type: "photo",
    filename: filename ?? null,
    preview_key: previewKey,
    thumb_key: thumbKey,
    original_key: originalKey,
    width,
    height,
    status: "ready",
    position,
  });
  if (error) throw new Error(error.message);

  return { mediaId, previewKey, thumbKey };
}
