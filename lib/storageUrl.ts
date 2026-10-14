import "server-only";

export function previewUrl(key: string | null | undefined): string | null {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/+$/, "");
  if (!key || !base) return null;
  return `${base}/${key}`;
}
