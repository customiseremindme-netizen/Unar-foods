import "server-only";
import type { PoolConnection as CallbackConnection } from "mysql2";
import mysql, { type Pool, type PoolConnection } from "mysql2/promise";

/**
 * MySQL / MariaDB connection settings (Hostinger: hPanel → Databases).
 * Either DATABASE_URL=mysql://user:pass@host:3306/name
 * or DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
 */
export type DbConfig = { host: string; port: number; database: string; user: string; password: string };

function read(name: string): string | undefined {
  let v = process.env[name]?.trim();
  if (!v) return undefined;
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.at(-1) === v[0]) v = v.slice(1, -1);
  if (!v || ["none", "-", "n/a", "null", "undefined", "empty"].includes(v.toLowerCase())) return undefined;
  if (/^PASTE_/i.test(v)) return undefined;
  return v;
}

export function getDbConfig(): DbConfig | null {
  const url = read("DATABASE_URL");
  if (url && /^mysql:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      return {
        host: u.hostname,
        port: Number(u.port || 3306),
        database: decodeURIComponent(u.pathname.replace(/^\//, "")),
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
      };
    } catch {
      return null;
    }
  }
  const host = read("DB_HOST");
  const database = read("DB_NAME");
  const user = read("DB_USER");
  const password = read("DB_PASSWORD");
  if (!host || !database || !user || password === undefined) return null;
  return { host, port: Number(read("DB_PORT") ?? 3306) || 3306, database, user, password };
}

/** True while `next build` runs: the database is never contacted then. */
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

const globalForDb = globalThis as unknown as { __unarPool?: Pool; __unarPoolKey?: string };

export function getPool(): Pool | null {
  if (isBuildPhase()) return null;
  const cfg = getDbConfig();
  if (!cfg) return null;
  const key = `${cfg.host}:${cfg.port}/${cfg.database}/${cfg.user}`;
  if (globalForDb.__unarPool && globalForDb.__unarPoolKey === key) return globalForDb.__unarPool;
  const pool = mysql.createPool({
    ...cfg,
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 8) || 8,
    waitForConnections: true,
    connectTimeout: 8000,
    charset: "utf8mb4_unicode_ci",
    timezone: "Z",
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    decimalNumbers: true,
    multipleStatements: false,
    namedPlaceholders: false,
    // JSON always arrives as text (MySQL and MariaDB behave the same); values.ts parses it.
    typeCast: (field, next) => (field.type === "JSON" || field.extendedFormat === "json" ? field.string("utf8") : next()),
  });
  // Every connection works in UTC and strict mode. (These run before the
  // connection is used; a failure is logged instead of crashing the server.)
  pool.on("connection", (promiseConn) => {
    // mysql2 passes the callback-style connection here (its types say otherwise).
    const conn = promiseConn as unknown as CallbackConnection;
    const report = (err: Error | null) => {
      if (err) console.error("[db] could not configure a connection:", err.message);
    };
    conn.query("SET time_zone = '+00:00'", report);
    conn.query(
      "SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'",
      report,
    );
  });
  globalForDb.__unarPool = pool;
  globalForDb.__unarPoolKey = key;
  return pool;
}

export type Conn = Pool | PoolConnection;

/** Runs `fn` inside a transaction (commit on success, rollback on error). */
export async function withTransaction<T>(pool: Pool, fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors; the original error matters
    }
    throw error;
  } finally {
    conn.release();
  }
}
