import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { RowDataPacket } from "mysql2/promise";
import { getReadyPool } from "@/lib/db/install";
import { withTransaction } from "@/lib/db/pool";

/** Limits for customer uploads on reviews. */
export const REVIEW_MEDIA_LIMITS = {
  maxPhotos: 5,
  maxVideos: 1,
  photoBytes: 10 * 1024 * 1024,
  videoBytes: 25 * 1024 * 1024,
  /** Videos are stored in pieces of this size (fits any MySQL packet limit). */
  chunkBytes: 1024 * 1024,
  /** Uploads not attached to a review within this time are deleted. */
  orphanHours: 24,
} as const;

export class ReviewMediaError extends Error {}

export type StoredReviewMedia = { id: string; kind: "image" | "video"; url: string; width: number | null; height: number | null };

export const reviewMediaUrl = (id: string, kind: "image" | "video") => `/review-media/${id}.${kind === "image" ? "webp" : "video"}`;

/** Recognises MP4/MOV (ISO base media) and WebM by their first bytes, not by the name the browser sent. */
function sniffVideo(head: Buffer): string | null {
  if (head.length >= 12 && head.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = head.subarray(8, 12).toString("latin1");
    return brand.startsWith("qt") ? "video/quicktime" : "video/mp4";
  }
  if (head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3) return "video/webm";
  return null;
}

/**
 * Checks and stores one photo or video from a signed-in customer.
 * - Photos are decoded and re-encoded to WebP (removes location data and any
 *   hidden content), at most 1600 px.
 * - Videos must really be MP4, MOV or WebM and at most 25 MB.
 * The upload stays private until it is attached to a review that staff approve.
 */
export async function storeReviewMedia(file: File, userId: string): Promise<StoredReviewMedia> {
  if (!(file instanceof File) || file.size === 0) throw new ReviewMediaError("Please choose a photo or video.");
  const pool = await getReadyPool();
  const [pending] = await pool.query<RowDataPacket[]>(
    "SELECT kind, COUNT(*) AS n FROM review_media WHERE user_id = ? AND review_id IS NULL AND created_at > UTC_TIMESTAMP(3) - INTERVAL 1 DAY GROUP BY kind",
    [userId],
  );
  const waiting = (kind: string) => Number(pending.find((r) => r.kind === kind)?.n ?? 0);

  const head = Buffer.from(await file.slice(0, 16).arrayBuffer());
  const videoType = sniffVideo(head);
  if (videoType || file.type.startsWith("video/")) {
    if (!videoType) throw new ReviewMediaError("Please upload the video as MP4, MOV or WebM.");
    if (file.size > REVIEW_MEDIA_LIMITS.videoBytes) throw new ReviewMediaError("This video is too large. Please keep it under 25 MB (about 30 seconds).");
    if (waiting("video") >= 3) throw new ReviewMediaError("You have uploaded several videos recently. Please finish your review first.");
    const data = Buffer.from(await file.arrayBuffer());
    const id = randomUUID();
    const chunks = Math.ceil(data.length / REVIEW_MEDIA_LIMITS.chunkBytes);
    await withTransaction(pool, async (conn) => {
      await conn.execute("INSERT INTO review_media (id, user_id, kind, mime_type, size_bytes, chunk_count) VALUES (?, ?, 'video', ?, ?, ?)", [id, userId, videoType, data.length, chunks]);
      for (let seq = 0; seq < chunks; seq++) {
        const part = data.subarray(seq * REVIEW_MEDIA_LIMITS.chunkBytes, (seq + 1) * REVIEW_MEDIA_LIMITS.chunkBytes);
        await conn.execute("INSERT INTO review_media_chunks (media_id, seq, data) VALUES (?, ?, ?)", [id, seq, part]);
      }
    });
    return { id, kind: "video", url: reviewMediaUrl(id, "video"), width: null, height: null };
  }

  if (file.size > REVIEW_MEDIA_LIMITS.photoBytes) throw new ReviewMediaError("This photo is too large. Please use one under 10 MB.");
  if (waiting("image") >= 15) throw new ReviewMediaError("You have uploaded several photos recently. Please finish your review first.");
  let output: { data: Buffer; info: { width: number; height: number } };
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error", limitInputPixels: 60_000_000 }).rotate();
    const meta = await image.metadata();
    if (!meta.format || !["jpeg", "png", "webp", "avif", "heif", "gif"].includes(meta.format)) throw new Error("format");
    output = await image.resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  } catch {
    throw new ReviewMediaError("This file isn't a photo we can use. Please choose a JPG, PNG, WebP or HEIC image.");
  }
  const id = randomUUID();
  await pool.execute("INSERT INTO review_media (id, user_id, kind, mime_type, size_bytes, width, height, data) VALUES (?, ?, 'image', 'image/webp', ?, ?, ?, ?)", [
    id,
    userId,
    output.data.length,
    output.info.width,
    output.info.height,
    output.data,
  ]);
  return { id, kind: "image", url: reviewMediaUrl(id, "image"), width: output.info.width, height: output.info.height };
}

/**
 * Links the customer's own, not-yet-used uploads to their new review.
 * Anything that isn't theirs, is already used or exceeds the limits is ignored.
 */
export async function attachReviewMedia(reviewId: string, userId: string, ids: string[]): Promise<number> {
  const unique = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/.test(id)))].slice(0, REVIEW_MEDIA_LIMITS.maxPhotos + REVIEW_MEDIA_LIMITS.maxVideos);
  if (!unique.length) return 0;
  const pool = await getReadyPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, kind FROM review_media WHERE user_id = ? AND review_id IS NULL AND id IN (${unique.map(() => "?").join(", ")})`,
    [userId, ...unique],
  );
  const photos = unique.filter((id) => rows.some((r) => r.id === id && r.kind === "image")).slice(0, REVIEW_MEDIA_LIMITS.maxPhotos);
  const videos = unique.filter((id) => rows.some((r) => r.id === id && r.kind === "video")).slice(0, REVIEW_MEDIA_LIMITS.maxVideos);
  const chosen = [...photos, ...videos];
  for (const [i, id] of chosen.entries()) {
    await pool.query("UPDATE review_media SET review_id = ?, sort_order = ? WHERE id = ? AND user_id = ? AND review_id IS NULL", [reviewId, i, id, userId]);
  }
  return chosen.length;
}

/** Removes uploads that were never attached to a review (run by the daily job). */
export async function deleteOrphanReviewMedia(): Promise<number> {
  const pool = await getReadyPool();
  const [result] = await pool.query<import("mysql2/promise").ResultSetHeader>(
    "DELETE FROM review_media WHERE review_id IS NULL AND created_at < UTC_TIMESTAMP(3) - INTERVAL ? HOUR",
    [REVIEW_MEDIA_LIMITS.orphanHours],
  );
  return result.affectedRows;
}
