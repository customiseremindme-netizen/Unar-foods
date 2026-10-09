import type { RowDataPacket } from "mysql2/promise";
import { getReadyPool } from "@/lib/db/install";
import { isBuildPhase } from "@/lib/db/pool";
import { logError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

const FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(webp|svg)$/i;

/**
 * Serves images uploaded in the dashboard (stored in the database).
 * Every upload gets a new address, so browsers may cache them forever.
 */
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const match = FILE.exec(file);
  if (!match || isBuildPhase()) return new Response("Not found", { status: 404 });
  const etag = `"${match[1].toLowerCase()}"`;
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { etag } });
  try {
    const pool = await getReadyPool();
    const [rows] = await pool.query<RowDataPacket[]>("SELECT mime_type, data FROM media_assets WHERE id = ?", [match[1].toLowerCase()]);
    const row = rows[0];
    if (!row?.data) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    const body = row.data as Buffer;
    const headers: Record<string, string> = {
      "content-type": String(row.mime_type),
      "content-length": String(body.length),
      "cache-control": "public, max-age=31536000, immutable",
      etag,
      "x-content-type-options": "nosniff",
    };
    // Uploaded SVGs are checked for scripts already; this blocks them again if one slipped through.
    if (row.mime_type === "image/svg+xml") headers["content-security-policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
    return new Response(new Uint8Array(body), { status: 200, headers });
  } catch (error) {
    logError("media.serve", error);
    return new Response("Temporarily unavailable", { status: 500, headers: { "cache-control": "no-store" } });
  }
}
