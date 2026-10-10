import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { DatabaseNotConfiguredError, getReadyPool } from "./install";
import { describeSetting } from "@/lib/env";
import { getDbConfig } from "./pool";

export type DatabaseHealth = { ok: boolean; database: string; fix?: string; owner?: string; database_settings?: Record<string, string> };

const DB_SETTINGS = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];

/** Which database settings the website can see (status only, never the values). */
function settingsStatus(): Record<string, string> {
  return Object.fromEntries(DB_SETTINGS.map((name) => [name, describeSetting(name)]));
}

const MISSING_FIX =
  "Create a MySQL database in Hostinger (Websites → Databases), then add DB_HOST (usually localhost), DB_PORT (3306), DB_NAME, DB_USER and DB_PASSWORD to the Node.js app's environment variables and redeploy.";

/** Plain-language database check for /api/health and the dashboard (never shows passwords). */
export async function checkDatabase(): Promise<DatabaseHealth> {
  if (!getDbConfig()) return { ok: false, database: "not configured", fix: MISSING_FIX, database_settings: settingsStatus() };
  try {
    const pool = await getReadyPool();
    const [settings] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM settings");
    const [owners] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM staff_members WHERE role = 'owner'");
    const owner = Number(owners[0]?.n) > 0 ? "created" : "not yet — open /setup on your site to create it";
    if (!Number(settings[0]?.n)) return { ok: false, database: "connected, but the starter data is missing", fix: "Redeploy once; the site loads it automatically.", owner };
    return { ok: true, database: "ok", owner };
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return { ok: false, database: "not configured", fix: MISSING_FIX, database_settings: settingsStatus() };
    const code = (error as { code?: string }).code ?? "";
    if (code === "ER_ACCESS_DENIED_ERROR" || code === "ER_DBACCESS_DENIED_ERROR") {
      return { ok: false, database: "the database refused the user name or password", fix: "Check DB_USER and DB_PASSWORD match the database user in Hostinger → Databases (the user name usually starts with u123456789_)." };
    }
    if (code === "ER_BAD_DB_ERROR") {
      return { ok: false, database: "the database name was not found", fix: "Check DB_NAME matches the database in Hostinger → Databases (it usually starts with u123456789_)." };
    }
    if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EHOSTUNREACH", "PROTOCOL_CONNECTION_LOST"].includes(code)) {
      return { ok: false, database: "unreachable", fix: "Check DB_HOST (on Hostinger it is usually localhost) and DB_PORT (3306), then redeploy." };
    }
    return { ok: false, database: "error while preparing the tables", fix: `Redeploy once. If it keeps happening, send this to your developer: ${code || (error as Error).message?.slice(0, 160)}` };
  }
}
