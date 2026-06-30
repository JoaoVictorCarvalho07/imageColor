/**
 * Configura CORS no bucket privado do R2 para permitir PUT direto do browser.
 * Executar uma vez: node scripts/setup-r2-cors.mjs
 */
import { readFileSync } from "fs";
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8").split("\n")
    .filter(l => l && !l.startsWith("#"))
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

await r2.send(new PutBucketCorsCommand({
  Bucket: "image-color-private",
  CORSConfiguration: {
    CORSRules: [{
      AllowedOrigins: [
        "https://imagecolor-nu.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
      ],
      AllowedMethods: ["PUT"],
      AllowedHeaders: ["content-type", "*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    }],
  },
}));

// Verifica
const { CORSRules } = await r2.send(new GetBucketCorsCommand({ Bucket: "image-color-private" }));
console.log("✅ CORS configurado em image-color-private:");
CORSRules?.forEach(r => {
  console.log("  Origins:", r.AllowedOrigins?.join(", "));
  console.log("  Methods:", r.AllowedMethods?.join(", "));
});
