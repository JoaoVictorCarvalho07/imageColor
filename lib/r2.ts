import "server-only";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ${name} ausente.`);
  return v;
}

export const BUCKET_PUBLIC = "image-color";
export const BUCKET_PRIVATE = "image-color-private";

let client: S3Client | null = null;

export function getR2(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${env("CLOUDFLARE_R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: env("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

export function r2PublicUrl(key: string): string {
  return `${env("CLOUDFLARE_R2_PUBLIC_URL")}/${key}`;
}

export function safeFilename(
  name: string | null | undefined,
  fallback = "arquivo",
): string {
  const base = (name ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
}

function contentDisposition(filename: string): string {
  const safe = safeFilename(filename);
  const ascii = safe
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/[\\;%]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export async function r2Upload(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getR2().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

export interface PresignedPutOptions {
  contentLength?: number;
  expiresIn?: number;
}

export async function r2PresignedPutUrl(
  bucket: string,
  key: string,
  contentType: string,
  options: PresignedPutOptions = {},
): Promise<string> {
  const { contentLength, expiresIn = 3600 } = options;
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
  });
  return getSignedUrl(getR2(), cmd, {
    expiresIn,
    signableHeaders: new Set(["content-type"]),
  });
}

export async function r2SignedUrl(
  bucket: string,
  key: string,
  expiresIn = 21600,
  filename?: string | null,
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(filename ? { ResponseContentDisposition: contentDisposition(filename) } : {}),
  });
  return getSignedUrl(getR2(), cmd, { expiresIn });
}

export async function r2Delete(bucket: string, key: string): Promise<void> {
  await getR2().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function r2DeleteMany(bucket: string, keys: string[]): Promise<void> {
  const failed: string[] = [];
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    const res = await getR2().send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((k) => ({ Key: k })), Quiet: true },
      }),
    );
    for (const e of res.Errors ?? []) if (e.Key) failed.push(e.Key);
  }
  if (failed.length > 0) {
    throw new Error(`Falha ao excluir ${failed.length} objeto(s): ${failed.join(", ")}`);
  }
}

export async function r2DeleteBestEffort(
  bucket: string,
  keys: string[],
  context: string,
): Promise<boolean> {
  const targets = keys.filter(Boolean);
  if (targets.length === 0) return true;
  try {
    await r2DeleteMany(bucket, targets);
    return true;
  } catch (err) {
    console.error(`[r2] falha ao excluir objetos (${context})`, {
      bucket,
      keys: targets,
      error: err instanceof Error ? err.message : err,
    });
    return false;
  }
}

export interface R2ObjectInfo {
  size: number;
  contentType: string | null;
}

export async function r2Head(bucket: string, key: string): Promise<R2ObjectInfo | null> {
  try {
    const res = await getR2().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

export interface R2Stream {
  stream: Readable;
  contentType: string | null;
  size: number | null;
}

export async function r2GetStream(
  bucket: string,
  key: string,
  signal?: AbortSignal,
): Promise<R2Stream> {
  const res = await getR2().send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    signal ? { abortSignal: signal } : undefined,
  );
  return {
    stream: res.Body as Readable,
    contentType: res.ContentType ?? null,
    size: res.ContentLength ?? null,
  };
}

export async function r2DownloadToFile(
  bucket: string,
  key: string,
  path: string,
): Promise<void> {
  const { stream } = await r2GetStream(bucket, key);
  await pipeline(stream, createWriteStream(path));
}

export async function r2Download(bucket: string, key: string): Promise<Buffer> {
  const { stream } = await r2GetStream(bucket, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
