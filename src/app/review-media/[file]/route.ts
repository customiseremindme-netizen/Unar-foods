import type { RowDataPacket } from "mysql2/promise";
import { getReadyPool } from "@/lib/db/install";
import { isBuildPhase } from "@/lib/db/pool";
import { getSessionUser, getStaffAccess } from "@/lib/auth/session";
import { REVIEW_MEDIA_LIMITS } from "@/lib/reviews/media";
import { logError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

const FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(webp|video)$/i;

const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

/**
 * Serves review photos and videos. Public only once the review is approved;
 * before that only the customer who uploaded it and review moderators can open it.
 * Videos support byte ranges so phones can stream and seek.
 */
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const match = FILE.exec((await params).file);
  if (!match || isBuildPhase()) return notFound();
  const id = match[1]!.toLowerCase();
  try {
    const pool = await getReadyPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT m.kind, m.mime_type, m.size_bytes, m.chunk_count, m.user_id, r.status AS review_status FROM review_media m LEFT JOIN reviews r ON r.id = m.review_id WHERE m.id = ?",
      [id],
    );
    const row = rows[0];
    if (!row || (row.kind === "image") !== (match[2]!.toLowerCase() === "webp")) return notFound();
    const isPublic = row.review_status === "approved";
    if (!isPublic) {
      const user = await getSessionUser();
      const staff = user ? await getStaffAccess() : null;
      if (!user || (user.id !== row.user_id && !staff?.permissions.has("reviews.moderate"))) return notFound();
    }
    const base: Record<string, string> = {
      "content-type": String(row.mime_type),
      "cache-control": isPublic ? "public, max-age=3600" : "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "accept-ranges": row.kind === "video" ? "bytes" : "none",
    };

    if (row.kind === "image") {
      const [data] = await pool.query<RowDataPacket[]>("SELECT data FROM review_media WHERE id = ?", [id]);
      const body = data[0]?.data as Buffer | undefined;
      if (!body) return notFound();
      return new Response(new Uint8Array(body), { headers: { ...base, "content-length": String(body.length) } });
    }

    const size = Number(row.size_bytes);
    const chunk = REVIEW_MEDIA_LIMITS.chunkBytes;
    let start = 0;
    let end = size - 1;
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
    if (range) {
      if (range[1] === "" && range[2] !== "") {
        start = Math.max(0, size - Number(range[2]));
      } else {
        start = Number(range[1] || 0);
        if (range[2]) end = Math.min(end, Number(range[2]));
      }
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { ...base, "content-range": `bytes */${size}` } });
      }
      // Answer at most a few megabytes at a time; the player asks for more.
      end = Math.min(end, start + 4 * chunk - 1);
    }
    const [parts] = await pool.query<RowDataPacket[]>("SELECT seq, data FROM review_media_chunks WHERE media_id = ? AND seq BETWEEN ? AND ? ORDER BY seq", [
      id,
      Math.floor(start / chunk),
      Math.floor(end / chunk),
    ]);
    const joined = Buffer.concat(parts.map((p) => p.data as Buffer));
    const offset = start - Math.floor(start / chunk) * chunk;
    const body = joined.subarray(offset, offset + (end - start + 1));
    const headers = { ...base, "content-length": String(body.length) };
    if (!range) return new Response(new Uint8Array(body), { headers });
    return new Response(new Uint8Array(body), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${start + body.length - 1}/${size}` } });
  } catch (error) {
    logError("review_media.serve", error);
    return new Response("Temporarily unavailable", { status: 500, headers: { "cache-control": "no-store" } });
  }
}
