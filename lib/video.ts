import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import ffmpegStatic from "ffmpeg-static";
import { escapeXml } from "./watermark";

const exec = promisify(execFile);

const FFMPEG_TIMEOUT_MS = 240_000;
const FFMPEG_THREADS = "2";

const ffmpegPath = ((ffmpegStatic as unknown as { default?: string }).default ??
  ffmpegStatic) as string | null;

export interface ProcessedVideo {
  preview: Buffer;
  thumb: Buffer;
}

function watermarkPng(size: number, text: string): Promise<Buffer> {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="wm" width="440" height="240" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
        <text x="0" y="130" font-family="Arial, Helvetica, sans-serif" font-size="34" letter-spacing="6" fill="#ffffff" fill-opacity="0.34">${escapeXml(text)}</text>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#wm)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function processVideo(
  inputPath: string,
  text: string,
): Promise<ProcessedVideo> {
  if (!ffmpegPath) throw new Error("ffmpeg indisponível (ffmpeg-static).");
  await access(ffmpegPath).catch(() => {
    throw new Error("Binário do ffmpeg não encontrado no servidor.");
  });

  const dir = await mkdtemp(join(tmpdir(), "ic-vid-"));
  const wmPath = join(dir, "wm.png");
  const outPath = join(dir, "out.mp4");
  const posterPath = join(dir, "poster.png");
  const execOpts = {
    maxBuffer: 1024 * 1024 * 16,
    timeout: FFMPEG_TIMEOUT_MS,
    killSignal: "SIGKILL" as const,
  };

  try {
    await writeFile(wmPath, await watermarkPng(1600, text.toUpperCase()));

    await exec(
      ffmpegPath,
      [
        "-y",
        "-threads", FFMPEG_THREADS,
        "-i", inputPath,
        "-i", wmPath,
        "-filter_complex",
        "[0:v]scale='min(1280,iw)':-2[v];[v][1:v]overlay=0:0:format=auto[o]",
        "-filter_complex_threads", FFMPEG_THREADS,
        "-map", "[o]",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-threads", FFMPEG_THREADS,
        "-crf", "30",
        "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-t", "90",
        outPath,
      ],
      execOpts,
    );

    await exec(
      ffmpegPath,
      ["-y", "-threads", FFMPEG_THREADS, "-i", outPath, "-frames:v", "1", posterPath],
      execOpts,
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
