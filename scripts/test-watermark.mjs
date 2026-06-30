import sharp from "sharp";
import { writeFileSync } from "node:fs";

function watermarkSvg(w, h, text, opacity) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" width="260" height="160" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
          <text x="0" y="80" font-family="Arial, Helvetica, sans-serif" font-size="20" letter-spacing="3" fill="#2A1F18" fill-opacity="${opacity}">${text} &#183; ${text}</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)"/>
    </svg>`,
  );
}

async function makeVariant(input, maxPx, text, opacity) {
  const resized = await sharp(input)
    .rotate()
    .resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = resized.info;
  return sharp(resized.data)
    .composite([{ input: watermarkSvg(width, height, text, opacity), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

// "foto" de teste (tons da paleta da Bebel + formas)
const W = 1600, H = 1200;
const sampleSvg = Buffer.from(
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#b89a82"/>
    <circle cx="560" cy="520" r="320" fill="#d9c3a5"/>
    <rect x="900" y="240" width="560" height="760" rx="36" fill="#8fa08a"/>
    <rect x="120" y="900" width="1360" height="220" rx="24" fill="#a98c6b"/>
  </svg>`,
);
const sample = await sharp(sampleSvg).png().toBuffer();

const preview = await makeVariant(sample, 1200, "ISABEL PONTES", 0.22);
const thumb = await makeVariant(sample, 400, "ISABEL PONTES", 0.22);
writeFileSync("scripts/out-preview.png", preview);
writeFileSync("scripts/out-thumb.png", thumb);
console.log("OK — preview", preview.length, "bytes, thumb", thumb.length, "bytes");
