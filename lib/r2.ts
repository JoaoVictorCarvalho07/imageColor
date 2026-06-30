import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID!;
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!;

/** Bucket público — previews com marca d'água + miniaturas. URL direta, sem autenticação. */
export const BUCKET_PUBLIC = "image-color";
/** Bucket privado — originais + fotos finais entregues. Acesso só por URL assinada. */
export const BUCKET_PRIVATE = "image-color-private";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

/** URL pública direta de um objeto no bucket public (previews/thumbs). */
export function r2PublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`;
}

/** Faz upload de um Buffer para o R2. */
export async function r2Upload(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await r2.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

/**
 * Gera URL assinada para PUT direto do browser ao R2.
 * Permite upload sem passar pelo Vercel (contorna o limite de 4.5MB).
 */
export async function r2PresignedPutUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(r2, cmd, { expiresIn });
}

/**
 * Gera URL assinada para acesso temporário a um objeto privado.
 * `filename` adiciona Content-Disposition: attachment (para download).
 */
export async function r2SignedUrl(
  bucket: string,
  key: string,
  expiresIn = 21600,
  filename?: string | null,
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(filename
      ? { ResponseContentDisposition: `attachment; filename="${filename}"` }
      : {}),
  });
  return getSignedUrl(r2, cmd, { expiresIn });
}

/** Baixa um objeto do R2 e retorna como Buffer. */
export async function r2Download(bucket: string, key: string): Promise<Buffer> {
  const res = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
