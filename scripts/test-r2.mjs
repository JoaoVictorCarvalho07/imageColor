/**
 * Testa a conexão com o Cloudflare R2:
 * - upload no bucket público (image-color)
 * - upload no bucket privado (image-color-private)
 * - gera URL assinada do privado
 * Uso: node scripts/test-r2.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
    .split("\n").filter(l => l && !l.startsWith("#"))
    .map(l => l.split("=").map(p => p.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")])
);

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_PUBLIC  = "image-color";
const BUCKET_PRIVATE = "image-color-private";
const PUBLIC_URL     = env.CLOUDFLARE_R2_PUBLIC_URL;
const TEST_KEY       = `_test/imagecolor-${Date.now()}.txt`;
const TEST_BODY      = Buffer.from("imageColor R2 test OK");

async function run() {
  // ── Bucket público ─────────────────────────────────────────────────────
  process.stdout.write(`\n── Bucket público (${BUCKET_PUBLIC}) ──\n`);
  await r2.send(new PutObjectCommand({ Bucket: BUCKET_PUBLIC, Key: TEST_KEY, Body: TEST_BODY, ContentType: "text/plain" }));
  const publicUrl = `${PUBLIC_URL}/${TEST_KEY}`;
  const res = await fetch(publicUrl);
  if (res.ok) {
    console.log(`✅  Upload + acesso público OK`);
    console.log(`   ${publicUrl}`);
  } else {
    console.error(`❌  Upload ok, mas URL pública retornou ${res.status}`);
    console.log("   → Verifique se o acesso público está habilitado no bucket.");
  }
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_PUBLIC, Key: TEST_KEY }));

  // ── Bucket privado ─────────────────────────────────────────────────────
  process.stdout.write(`\n── Bucket privado (${BUCKET_PRIVATE}) ──\n`);
  try {
    await r2.send(new PutObjectCommand({ Bucket: BUCKET_PRIVATE, Key: TEST_KEY, Body: TEST_BODY, ContentType: "text/plain" }));
    const signedUrl = await getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET_PRIVATE, Key: TEST_KEY }), { expiresIn: 60 });
    const res2 = await fetch(signedUrl);
    if (res2.ok) {
      console.log(`✅  Upload + URL assinada OK`);
    } else {
      console.error(`❌  URL assinada retornou ${res2.status}`);
    }
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_PRIVATE, Key: TEST_KEY }));
  } catch (e) {
    console.error(`❌  Erro: ${e.message}`);
    console.log("   → Verifique se o bucket 'image-color-private' foi criado no R2.");
  }

  console.log("\nPronto.\n");
}

run().catch(e => { console.error(e); process.exit(1); });
