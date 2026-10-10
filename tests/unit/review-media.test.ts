import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeReviewMedia } from "@/lib/reviews/media";

describe("review media processing", () => {
  it("re-encodes a real image to bounded WebP", async () => {
    const source = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "green" } }).png().toBuffer();
    const encoded = await encodeReviewMedia(new File([new Uint8Array(source)], "photo.png", { type: "image/png" }));
    const metadata = await sharp(encoded.data).metadata();
    expect(encoded.mime).toBe("image/webp");
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(800);
    expect(metadata.exif).toBeUndefined();
  });
  it("rejects disguised SVG and invalid video bytes", async () => {
    await expect(encodeReviewMedia(new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], "photo.png", { type: "image/png" }))).rejects.toThrow();
    await expect(encodeReviewMedia(new File(["not a video"], "video.mp4", { type: "video/mp4" }))).rejects.toThrow("valid MP4");
  });
  it("transcodes a real MP4 to a playable H264 file with metadata removed", async () => {
    const directory = await mkdtemp(join(tmpdir(), "unar-media-test-"));
    try {
      const source = join(directory, "source.mp4");
      execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "color=c=green:s=320x240:d=1", "-metadata", "title=private metadata", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", source], { timeout: 15000 });
      const encoded = await encodeReviewMedia(new File([new Uint8Array(await readFile(source))], "video.mp4", { type: "video/mp4" }));
      expect(encoded.mime).toBe("video/mp4");
      expect(encoded.width).toBe(320);
      expect(encoded.height).toBe(240);
      expect(encoded.data.includes(Buffer.from("private metadata"))).toBe(false);
      expect(encoded.data.toString("ascii", 4, 8)).toBe("ftyp");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
