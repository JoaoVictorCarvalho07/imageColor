export const PHOTO_MAX_BYTES = 60 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const FINAL_MAX_BYTES = 200 * 1024 * 1024;

export const PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export const FINAL_TYPES = [...PHOTO_TYPES, "image/tiff"] as const;

export const MEDIA_TYPES: readonly string[] = [...PHOTO_TYPES, ...VIDEO_TYPES];

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
  tif: "image/tiff",
  tiff: "image/tiff",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export const isVideoType = (type: string): boolean => type.startsWith("video/");

export const isMediaType = (type: string): boolean => MEDIA_TYPES.includes(type);

export const isFinalType = (type: string): boolean =>
  (FINAL_TYPES as readonly string[]).includes(type);

export const maxBytesFor = (type: string): number =>
  isVideoType(type) ? VIDEO_MAX_BYTES : PHOTO_MAX_BYTES;

export function resolveContentType(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? "";
}

export function formatLimit(bytes: number): string {
  return bytes >= 1024 ** 3
    ? `${bytes / 1024 ** 3} GB`
    : `${Math.round(bytes / 1024 ** 2)} MB`;
}
