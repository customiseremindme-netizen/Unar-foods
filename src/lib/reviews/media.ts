import "server-only";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_REVIEW_VIDEO_BYTES } from "./media-policy";

const run = promisify(execFile);
export type EncodedReviewMedia = { data: Buffer; mime: "image/webp" | "video/mp4"; width: number; height: number };

/** Decode and re-encode uploads; never serve customer-supplied bytes as an image. */
export async function encodeReviewMedia(file: File): Promise<EncodedReviewMedia> {
  const input = Buffer.from(await file.arrayBuffer());
  if (file.type !== "video/mp4") {
    const image = sharp(input, { failOn: "error", limitInputPixels: 30_000_000 }).rotate();
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "avif", "heif"].includes(metadata.format) || (metadata.pages ?? 1) > 1) throw new Error("Use a valid, still product photo.");
    const out = await image.resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    return { data: out.data, mime: "image/webp", width: out.info.width, height: out.info.height };
  }
  if (input.length < 12 || input.toString("ascii", 4, 8) !== "ftyp") throw new Error("Use a valid MP4 video.");
  const directory = await mkdtemp(join(tmpdir(), "unar-review-"));
  try {
    const source = join(directory, "source.mp4"), destination = join(directory, "video.mp4");
    await writeFile(source, input);
    const probe = await run(process.env.UNAR_FFPROBE_PATH || "ffprobe", ["-v", "error", "-protocol_whitelist", "file", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", source], { timeout: 15_000, maxBuffer: 128_000 });
    const meta = JSON.parse(probe.stdout) as { format?: { duration?: string }; streams?: { codec_type?: string; width?: number; height?: number }[] };
    const video = meta.streams?.find((s) => s.codec_type === "video");
    const duration = Number(meta.format?.duration);
    if (!video?.width || !video.height || !Number.isFinite(duration) || duration <= 0 || duration > 30 || video.width * video.height > 8_300_000) throw new Error("Use an MP4 video up to 30 seconds and 4K resolution.");
    await run(process.env.UNAR_FFMPEG_PATH || "ffmpeg", ["-nostdin", "-v", "error", "-protocol_whitelist", "file", "-i", source, "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1", "-map_chapters", "-1", "-vf", "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-threads", "2", "-movflags", "+faststart", "-y", destination], { timeout: 40_000, maxBuffer: 128_000 });
    const data = await readFile(destination);
    if (data.length > MAX_REVIEW_VIDEO_BYTES) throw new Error("The video is too large after processing. Please use a shorter clip.");
    return { data, mime: "video/mp4", width: Math.max(2, Math.floor(video.width * Math.min(1, 1280 / video.width, 1280 / video.height) / 2) * 2), height: Math.max(2, Math.floor(video.height * Math.min(1, 1280 / video.width, 1280 / video.height) / 2) * 2) };
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") throw new Error("Video uploads are not available on this server yet. Please add photos instead.");
    throw error;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
