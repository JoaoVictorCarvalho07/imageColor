import "server-only";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { superuserPb } from "./pb/superuser";
import { processImage } from "./watermark";
import { processVideo } from "./video";
import {
  r2Upload,
  r2Download,
  r2DownloadToFile,
  r2DeleteBestEffort,
  BUCKET_PUBLIC,
  BUCKET_PRIVATE,
} from "./r2";

const OBJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const newObjectId = (): string => crypto.randomUUID();

export const isValidObjectId = (id: unknown): id is string =>
  typeof id === "string" && OBJECT_ID_PATTERN.test(id);

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

async function uploadAll(uploads: Promise<void>[]): Promise<void> {
  const results = await Promise.allSettled(uploads);
  const failed = results.find(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  if (failed) throw failed.reason;
}

async function discardPublic(keys: string[], context: string): Promise<void> {
  await r2DeleteBestEffort(BUCKET_PUBLIC, keys, context);
}

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

  try {
    await uploadAll([
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
  } catch (err) {
    await Promise.all([
      discardPublic([previewKey, thumbKey], "storePhoto"),
      r2DeleteBestEffort(BUCKET_PRIVATE, [originalKey], "storePhoto"),
    ]);
    throw err;
  }
}

export interface StorePhotoFromKeyOpts {
  galleryId: string;
  objectId: string;
  originalKey: string;
  position: number;
  watermarkText: string;
  filename?: string | null;
}

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

  try {
    await uploadAll([
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
  } catch (err) {
    await discardPublic([previewKey, thumbKey], "storePhotoFromR2Key");
    throw err;
  }
}

export interface StoreVideoFromKeyOpts {
  galleryId: string;
  objectId: string;
  originalKey: string;
  position: number;
  watermarkText: string;
  filename?: string | null;
}

export async function storeVideoFromR2Key(
  opts: StoreVideoFromKeyOpts,
): Promise<StoredPhoto> {
  const { galleryId, objectId, originalKey, position, watermarkText, filename } =
    opts;

  const dir = await mkdtemp(join(tmpdir(), "ic-src-"));
  const inputPath = join(dir, "input");
  const { thumbKey } = keysFor(galleryId, objectId);
  const previewKey = `${galleryId}/${objectId}.mp4`;

  try {
    await r2DownloadToFile(BUCKET_PRIVATE, originalKey, inputPath);
    const { preview, thumb } = await processVideo(inputPath, watermarkText);

    try {
      await uploadAll([
        r2Upload(BUCKET_PUBLIC, previewKey, preview, "video/mp4"),
        r2Upload(BUCKET_PUBLIC, thumbKey, thumb, "image/webp"),
      ]);

      const pb = await superuserPb();
      const rec = await pb.collection("media_items").create<{ id: string }>({
        gallery: galleryId,
        type: "video",
        preview_key: previewKey,
        thumb_key: thumbKey,
        original_key: originalKey,
        filename: filename ?? "",
        status: "ready",
        position,
      });

      return { mediaId: rec.id, previewKey, thumbKey };
    } catch (err) {
      await discardPublic([previewKey, thumbKey], "storeVideoFromR2Key");
      throw err;
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
