import type { RowDataPacket } from "mysql2/promise";
import { getReadyPool } from "@/lib/db/install";
import { getSessionUser, getStaffAccess } from "@/lib/auth/session";
import { logError } from "@/lib/monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PRIVATE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new Response("Not found", { status: 404, headers: PRIVATE });
  try {
    const pool = await getReadyPool();
    const [rows] = await pool.query<RowDataPacket[]>("SELECT m.owner_id, m.mime_type, m.data, r.status AS review_status, p.status AS product_status FROM review_media m LEFT JOIN reviews r ON r.id = m.review_id LEFT JOIN products p ON p.id = r.product_id WHERE m.id = ?", [id]);
    const row = rows[0];
    if (!row?.data) return new Response("Not found", { status: 404, headers: PRIVATE });
    if (row.review_status !== "approved" || row.product_status !== "published") {
      const user = await getSessionUser();
      if (!user || (user.id !== row.owner_id && !(await getStaffAccess())?.permissions.has("reviews.moderate"))) return new Response("Not found", { status: 404, headers: PRIVATE });
    }
    const data = row.data as Buffer;
    const headers: Record<string, string> = { ...PRIVATE, "Content-Type": String(row.mime_type), "Content-Disposition": `inline; filename="${id}.${row.mime_type === "video/mp4" ? "mp4" : "webp"}"`, "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; sandbox", "Accept-Ranges": "bytes" };
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start = 0, end = data.length - 1;
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { ...PRIVATE, "Content-Range": `bytes */${data.length}` } });
      if (!match[1]) start = Math.max(0, data.length - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= data.length) return new Response(null, { status: 416, headers: { ...PRIVATE, "Content-Range": `bytes */${data.length}` } });
      headers["Content-Range"] = `bytes ${start}-${end}/${data.length}`;
      headers["Content-Length"] = String(end - start + 1);
      return new Response(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers });
    }
    headers["Content-Length"] = String(data.length);
    return new Response(new Uint8Array(data), { headers });
  } catch (error) {
    logError("review.media.serve", error);
    return new Response("Temporarily unavailable", { status: 503, headers: PRIVATE });
  }
}
