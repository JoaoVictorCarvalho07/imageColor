import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import ffmpegStatic from "ffmpeg-static";

const exec = promisify(execFile);

// ffmpeg-static exporta o caminho do binário (string).
const ffmpegPath = ((ffmpegStatic as unknown as { default?: string }).default ??
  ffmpegStatic) as string | null;

export interface ProcessedVideo {
  preview: Buffer; // mp4 720p com marca d'água
  thumb: Buffer; // poster webp com marca d'água
}

/** PNG transparente com marca d'água diagonal repetida (para overlay no vídeo). */
function watermarkPng(size: number, text: string): Promise<Buffer> {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="wm" width="440" height="240" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
        <text x="0" y="130" font-family="Arial, Helvetica, sans-serif" font-size="34" letter-spacing="6" fill="#ffffff" fill-opacity="0.34">${text}</text>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#wm)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Transcodifica para preview 720p com marca d'água sobreposta + gera poster. */
export async function processVideo(
  input: Buffer,
  text: string,
): Promise<ProcessedVideo> {
  if (!ffmpegPath) throw new Error("ffmpeg indisponível (ffmpeg-static).");

  const dir = await mkdtemp(join(tmpdir(), "ic-vid-"));
  const inPath = join(dir, "in");
  const wmPath = join(dir, "wm.png");
  const outPath = join(dir, "out.mp4");
  const posterPath = join(dir, "poster.png");

  try {
    await writeFile(inPath, input);
    await writeFile(wmPath, await watermarkPng(1600, text.toUpperCase()));

    // Escala para no máx. 1280 de largura e sobrepõe a marca d'água.
    // -t 90: preview limitado a 90s. -map 0:a? mantém áudio se houver.
    await exec(
      ffmpegPath,
      [
        "-y",
        "-i", inPath,
        "-i", wmPath,
        "-filter_complex",
        "[0:v]scale='min(1280,iw)':-2[v];[v][1:v]overlay=0:0:format=auto[o]",
        "-map", "[o]",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-crf", "30",
        "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-t", "90",
        outPath,
      ],
      { maxBuffer: 1024 * 1024 * 64 },
    );

    // Poster a partir do vídeo já com marca d'água (primeiro frame).
    await exec(
      ffmpegPath,
      ["-y", "-i", outPath, "-frames:v", "1", posterPath],
      { maxBuffer: 1024 * 1024 * 16 },
    );

    const preview = await readFile(outPath);
    const posterBuf = await readFile(posterPath);
    const thumb = await sharp(posterBuf)
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();

    return { preview, thumb };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
