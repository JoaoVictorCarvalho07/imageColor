import sharp from "sharp";

export interface WatermarkOptions {
  text?: string;
  opacity?: number;
}

export interface ProcessedImage {
  preview: Buffer; // webp ~1600px, com marca d'água
  thumb: Buffer; // webp ~400px, com marca d'água
  width: number; // dimensões do preview
  height: number;
}

function escapeXml(s: string): string {
  return s.replace(
    /[<>&'"]/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[
        c
      ] as string,
  );
}

function watermarkSvg(
  w: number,
  h: number,
  text: string,
  opacity: number,
): Buffer {
  const safe = escapeXml(text);
  // Padrão diagonal repetido — difícil de remover (cobre a imagem toda).
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" width="330" height="180" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <text x="0" y="95" font-family="Arial, Helvetica, sans-serif" font-size="24" letter-spacing="4" fill="#2A1F18" fill-opacity="${opacity}">${safe}</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)"/>
    </svg>`,
  );
}

async function variant(
  input: Buffer,
  maxPx: number,
  text: string,
  opacity: number,
  quality: number,
): Promise<{ buf: Buffer; width: number; height: number }> {
  const resized = await sharp(input)
    .rotate() // respeita orientação EXIF
    .resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = resized.info;
  const buf = await sharp(resized.data)
    .composite([{ input: watermarkSvg(width, height, text, opacity), top: 0, left: 0 }])
    .webp({ quality })
    .toBuffer();
  return { buf, width: width ?? maxPx, height: height ?? maxPx };
}

/** Gera preview e thumbnail com marca d'água a partir do buffer original. */
export async function processImage(
  input: Buffer,
  opts: WatermarkOptions = {},
): Promise<ProcessedImage> {
  const text = (opts.text || "ISABEL PONTES").toUpperCase();
  const opacity = opts.opacity ?? 0.22;
  const preview = await variant(input, 1600, text, opacity, 72);
  const thumb = await variant(input, 400, text, opacity, 70);
  return {
    preview: preview.buf,
    thumb: thumb.buf,
    width: preview.width,
    height: preview.height,
  };
}
