import type { Pool } from "mysql2/promise";
import { DbError, toDbError, type DbContext } from "./context";
import { deleteRows, insertRows, readRows, updateRows, type Prefer } from "./engine";
import { parseQuery, QueryParseError } from "./parse";

/**
 * The in-process "data API": the query builder used across the app sends its
 * requests here instead of over the network. Each request is answered from
 * MySQL with the caller's access rules applied.
 */

export type RpcHandler = (ctx: DbContext, args: Record<string, unknown>, pool: Pool) => Promise<unknown>;

const OBJECT = "application/vnd.pgrst.object+json";

function parsePrefer(headers: Headers): Prefer {
  const raw = headers.get("prefer") ?? "";
  return {
    returnRepresentation: /return=representation/.test(raw),
    resolution: /resolution=merge-duplicates/.test(raw) ? "merge" : /resolution=ignore-duplicates/.test(raw) ? "ignore" : undefined,
    count: /count=(exact|planned|estimated)/.test(raw),
  };
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

function errorResponse(error: unknown): Response {
  const err = error instanceof QueryParseError ? new DbError("PGRST100", error.message, 400) : toDbError(error);
  if (err.status >= 500) console.error(`[db] ${err.code}: ${err.message}`);
  return json(err.status, err.toJSON());
}

/** Applies `.single()` (exactly one row) to a list of rows. */
function shape(rows: unknown[], wantsObject: boolean): { status: number; body: unknown } {
  if (!wantsObject) return { status: 200, body: rows };
  if (rows.length !== 1) {
    return {
      status: 406,
      body: {
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
        details: `The result contains ${rows.length} rows`,
        hint: null,
      },
    };
  }
  return { status: 200, body: rows[0] };
}

function contentRange(offset: number, length: number, count: number | null): string {
  const total = count === null ? "*" : String(count);
  return length ? `${offset}-${offset + length - 1}/${total}` : `*/${total}`;
}

export async function handleDataRequest(
  pool: Pool,
  ctx: DbContext,
  rpcs: Record<string, RpcHandler>,
  input: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> {
  try {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    const wantsObject = (headers.get("accept") ?? "").startsWith(OBJECT);
    const prefer = parsePrefer(headers);
    const segments = url.pathname.replace(/^\/rest\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);

    let body: unknown = undefined;
    if (typeof init.body === "string" && init.body !== "") {
      try {
        body = JSON.parse(init.body);
      } catch {
        throw new DbError("PGRST102", "Invalid JSON body", 400);
      }
    }

    // Functions: /rest/rpc/<name>
    if (segments[0] === "rpc" && segments.length === 2) {
      const fn = rpcs[segments[1]];
      if (!fn) throw new DbError("PGRST202", `Could not find the function public.${segments[1]}`, 404);
      const args = method === "GET" || method === "HEAD" ? Object.fromEntries(url.searchParams) : ((body ?? {}) as Record<string, unknown>);
      const result = await fn(ctx, args, pool);
      if (wantsObject && Array.isArray(result)) {
        const shaped = shape(result, true);
        return json(shaped.status, shaped.body);
      }
      return json(200, result ?? null);
    }

    if (segments.length !== 1) throw new DbError("PGRST125", "Invalid path", 404);
    const table = segments[0];
    const query = parseQuery(url.searchParams);

    if (method === "GET" || method === "HEAD") {
      const result = await readRows(pool, ctx, table, query, !!prefer.count);
      const range = { "content-range": contentRange(result.offset, result.rows.length, result.count) };
      if (method === "HEAD") return new Response(null, { status: 200, headers: range });
      const shaped = shape(result.rows, wantsObject);
      return json(shaped.status, shaped.body, range);
    }

    const conn = await pool.getConnection();
    let rows: Record<string, unknown>[];
    try {
      await conn.beginTransaction();
      if (method === "POST") rows = await insertRows(conn, ctx, table, body, query, prefer);
      else if (method === "PATCH") rows = await updateRows(conn, ctx, table, body, query, prefer);
      else if (method === "DELETE") rows = await deleteRows(conn, ctx, table, query, prefer);
      else throw new DbError("PGRST117", `Unsupported method ${method}`, 405);
      if (wantsObject && prefer.returnRepresentation && rows.length !== 1) {
        await conn.rollback();
        const shaped = shape(rows, true);
        return json(shaped.status, shaped.body);
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback().catch(() => undefined);
      throw error;
    } finally {
      conn.release();
    }
    const status = method === "POST" ? 201 : 200;
    if (!prefer.returnRepresentation) return new Response(null, { status: 204 });
    const shaped = shape(rows, wantsObject);
    return json(shaped.status === 200 ? status : shaped.status, shaped.body, { "content-range": contentRange(0, rows.length, null) });
  } catch (error) {
    return errorResponse(error);
  }
}
