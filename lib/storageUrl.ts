const R2_PUBLIC = process.env.CLOUDFLARE_R2_PUBLIC_URL;

/** URL pública de um objeto no bucket de previews R2 (com marca d'água). */
export function previewUrl(key: string | null | undefined): string | null {
  if (!key || !R2_PUBLIC) return null;
  return `${R2_PUBLIC}/${key}`;
}
