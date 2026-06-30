/**
 * Verifica se o upload de teste chegou ao R2 nos buckets certos.
 * node scripts/check-r2-upload.mjs
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map(p => p.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join('=')])
);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY },
});

const galleryId = '1fda5bd1-829b-4f8e-a9a7-4724c0bfdd1b';
const mediaId   = '5814f5ae-2724-4d8d-b428-fead946b50d9';
const origKey   = `${galleryId}/${mediaId}_orig`;
const prevKey   = `${galleryId}/${mediaId}.webp`;
const thumbKey  = `${galleryId}/${mediaId}_t.webp`;
const pubUrl    = env.CLOUDFLARE_R2_PUBLIC_URL;

console.log('\n── Bucket PÚBLICO (image-color) ──');
for (const [label, key] of [['Preview ', prevKey], ['Thumb   ', thumbKey]]) {
  const url = `${pubUrl}/${key}`;
  const r = await fetch(url, { method: 'HEAD' });
  console.log(`  ${label} → ${r.status === 200 ? '✅ 200 OK' : '❌ '+r.status}  ${url}`);
}

console.log('\n── Bucket PRIVADO (image-color-private) ──');
const head = await r2.send(new HeadObjectCommand({ Bucket: 'image-color-private', Key: origKey }));
console.log(`  Original → ✅ existe no R2`);
console.log(`    Content-Type : ${head.ContentType}`);
console.log(`    Tamanho      : ${head.ContentLength} bytes`);

const signedUrl = await getSignedUrl(r2, new GetObjectCommand({ Bucket: 'image-color-private', Key: origKey }), { expiresIn: 60 });
const res = await fetch(signedUrl, { method: 'HEAD' });
console.log(`    URL assinada : ${res.status === 200 ? '✅ acessível' : '❌ status '+res.status}`);

console.log('\n── Supabase Storage (deve estar VAZIO para este arquivo) ──');
const supaUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/originals/${origKey}`;
const supaRes = await fetch(supaUrl, { method: 'HEAD' });
console.log(`  Original no Supabase → ${supaRes.status === 200 ? '⚠️  ainda lá!' : '✅ não existe ('+supaRes.status+')'}`);

const supaPreview = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/previews/${prevKey}`;
const supaRes2 = await fetch(supaPreview, { method: 'HEAD' });
console.log(`  Preview no Supabase  → ${supaRes2.status === 200 ? '⚠️  ainda lá!' : '✅ não existe ('+supaRes2.status+')'}`);

console.log('');
