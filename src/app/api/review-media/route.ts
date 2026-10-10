import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { getSessionUser } from "@/lib/auth/session";
import { getReadyPool } from "@/lib/db/install";
import { withTransaction } from "@/lib/db/pool";
import { isSameOrigin, getClientIp } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { encodeReviewMedia, type EncodedReviewMedia } from "@/lib/reviews/media";
import { MAX_REVIEW_UPLOAD_BYTES, validateReviewFiles } from "@/lib/reviews/media-policy";
import { getAllSettings } from "@/lib/settings";
import { logError } from "@/lib/monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return reply({ error: "Invalid origin" }, 403);
  const user = await getSessionUser();
  if (!user) return reply({ error: "Please sign in to upload review photos or videos." }, 401);
  if (!(await checkRateLimit("reviewUpload", user.id)) || !(await checkRateLimit("reviewUpload", await getClientIp()))) return reply({ error: "Too many uploads. Please try again later." }, 429);
  if (!(await getAllSettings()).reviews.enabled) return reply({ error: "Reviews are currently closed." }, 403);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return reply({ error: "Choose your files first." }, 400);
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "Choose your files first." }, 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_REVIEW_UPLOAD_BYTES) { await reader.cancel(); return reply({ error: "Your files are too large." }, 413); }
      chunks.push(part.value);
    }
    const body = Buffer.concat(chunks);
    const form = await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type")! }, body: new Uint8Array(body) }).formData();
    const files = form.getAll("files").filter((v): v is File => v instanceof File && v.size > 0);
    const validation = validateReviewFiles(files);
    if (validation) return reply({ error: validation }, 400);
    const encoded: EncodedReviewMedia[] = [];
    for (const file of files) encoded.push(await encodeReviewMedia(file));
    const pool = await getReadyPool();
    const media = await withTransaction(pool, async (conn) => {
      await conn.query("SELECT id FROM auth_users WHERE id = ? FOR UPDATE", [user.id]);
      await conn.query("DELETE FROM review_media WHERE owner_id = ? AND review_id IS NULL AND created_at < UTC_TIMESTAMP(3) - INTERVAL 1 DAY", [user.id]);
      const [counts] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM review_media WHERE owner_id = ? AND review_id IS NULL", [user.id]);
      if (Number(counts[0]?.n) + encoded.length > 12) throw new Error("You have several unfinished uploads. Please submit your review or try again tomorrow.");
      const out = [];
      for (const item of encoded) {
        const id = randomUUID();
        await conn.execute("INSERT INTO review_media (id, owner_id, mime_type, size_bytes, width, height, data) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, user.id, item.mime, item.data.length, item.width, item.height, item.data]);
        out.push({ id, url: `/review-media/${id}`, mime_type: item.mime, width: item.width, height: item.height });
      }
      return out;
    });
    return reply({ media }, 201);
  } catch (error) {
    logError("review.upload", error);
    const message = error instanceof Error && (/^(Use |The video |Video uploads |You have several)/.test(error.message)) ? error.message : "We couldn't process your files. Please use valid photos or a short MP4 clip.";
    return reply({ error: message }, 400);
  } finally { reader.releaseLock(); }
}
