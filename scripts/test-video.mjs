import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import ffmpegStatic from "ffmpeg-static";

const exec = promisify(execFile);
const ffmpegPath = ffmpegStatic;

const dir = await mkdtemp(join(tmpdir(), "ic-vidtest-"));
const inPath = join(dir, "in.mp4");
const wmPath = join(dir, "wm.png");
const outPath = join(dir, "out.mp4");
const posterPath = join(dir, "poster.png");

// 1. vídeo de teste (testsrc, 3s, 640x480)
await exec(ffmpegPath, [
  "-y", "-f", "lavfi", "-i", "testsrc=duration=3:size=640x480:rate=15",
  "-pix_fmt", "yuv420p", inPath,
]);

// 2. marca d'água png
const size = 1600;
const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="wm" width="440" height="240" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><text x="0" y="130" font-family="Arial" font-size="34" letter-spacing="6" fill="#ffffff" fill-opacity="0.34">ISABEL PONTES</text></pattern></defs><rect width="100%" height="100%" fill="url(#wm)"/></svg>`;
await writeFile(wmPath, await sharp(Buffer.from(svg)).png().toBuffer());

// 3. overlay + transcode
await exec(ffmpegPath, [
  "-y", "-i", inPath, "-i", wmPath,
  "-filter_complex", "[0:v]scale='min(1280,iw)':-2[v];[v][1:v]overlay=0:0:format=auto[o]",
  "-map", "[o]", "-map", "0:a?",
  "-c:v", "libx264", "-crf", "30", "-preset", "veryfast", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", "-t", "90", outPath,
], { maxBuffer: 1024 * 1024 * 64 });

// 4. poster
await exec(ffmpegPath, ["-y", "-i", outPath, "-frames:v", "1", posterPath]);

const out = await readFile(outPath);
const thumb = await sharp(await readFile(posterPath)).resize({ width: 640, fit: "inside" }).webp().toBuffer();
console.log("OK — preview:", (out.length / 1024).toFixed(0), "KB | thumb:", (thumb.length / 1024).toFixed(0), "KB");
await rm(dir, { recursive: true, force: true });
