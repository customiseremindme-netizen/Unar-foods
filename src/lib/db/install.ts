import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import initialData from "./data/initial-data.json";
import { addForeignKeySql, allColumns, columnSql, createTableSql, foreignKeys, keyName, q, schemaFingerprint } from "./ddl";
import { getPool } from "./pool";
import { prepareInsertRow } from "./rows";
import { TABLES } from "./schema";

/**
 * Creates and updates the database tables automatically.
 *
 * Runs once per server start (and is skipped in a few milliseconds when
 * nothing changed). The owner never has to paste SQL: creating an empty
 * MySQL database in Hostinger and adding its details is enough.
 *
 * Safe to run from several server processes at once (a database lock makes
 * them take turns). It only ever ADDS tables, columns, indexes and rules — it
 * never deletes data.
 */

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("The database is not connected yet. Add DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD in Hostinger.");
  }
}

const LOCK = "unar_schema_install";

type Rows = RowDataPacket[];

async function names(conn: PoolConnection, sql: string, params: unknown[] = []): Promise<Set<string>> {
  const [rows] = await conn.query<Rows>(sql, params);
  return new Set(rows.map((r) => String(Object.values(r)[0])));
}

async function readMeta(conn: PoolConnection): Promise<Map<string, string>> {
  const tables = await names(conn, "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_meta'");
  if (!tables.size) return new Map();
  const [rows] = await conn.query<Rows>("SELECT `key`, `value` FROM schema_meta");
  return new Map(rows.map((r) => [String(r.key), String(r.value)]));
}

async function setMeta(conn: PoolConnection, key: string, value: string) {
  await conn.query("INSERT INTO schema_meta (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?", [key, value, value]);
}

/** Brings every table, column, index, rule and relationship up to the definition in schema.ts. */
async function migrate(conn: PoolConnection) {
  const existing = await names(conn, "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");

  for (const [name, table] of Object.entries(TABLES)) {
    if (!existing.has(name)) {
      await conn.query(createTableSql(name, table));
      continue;
    }
    const columns = await names(conn, "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", [name]);
    for (const [col, def] of allColumns(table)) {
      if (!columns.has(col)) await conn.query(`ALTER TABLE ${q(name)} ADD COLUMN ${columnSql(col, def)}`);
    }
    const indexes = await names(conn, "SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", [name]);
    for (const cols of table.unique ?? []) {
      const key = keyName("uq", name, cols);
      if (!indexes.has(key)) await conn.query(`ALTER TABLE ${q(name)} ADD UNIQUE KEY ${q(key)} (${cols.map(q).join(", ")})`);
    }
    for (const cols of table.indexes ?? []) {
      const key = keyName("ix", name, cols);
      if (!indexes.has(key)) await conn.query(`ALTER TABLE ${q(name)} ADD KEY ${q(key)} (${cols.map(q).join(", ")})`);
    }
    const checks = await names(
      conn,
      "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'",
      [name],
    );
    for (const [i, check] of (table.checks ?? []).entries()) {
      const key = keyName("ck", name, String(i + 1));
      if (checks.has(key)) continue;
      try {
        await conn.query(`ALTER TABLE ${q(name)} ADD CONSTRAINT ${q(key)} CHECK (${check})`);
      } catch (error) {
        // Existing rows break the new rule: keep the site running, the app still validates.
        console.warn(`[db] could not add rule ${key}:`, (error as Error).message);
      }
    }
  }

  const fks = await names(
    conn,
    "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
  );
  for (const [name, table] of Object.entries(TABLES)) {
    for (const fk of foreignKeys(name, table)) {
      if (!fks.has(fk.name)) await conn.query(addForeignKeySql(fk));
    }
  }
}

/** Loads the starter content (brand settings, the two products as drafts, pages, FAQs) once. */
async function loadInitialData(conn: PoolConnection) {
  await conn.beginTransaction();
  try {
    for (const [tableName, rows] of Object.entries(initialData as Record<string, Record<string, unknown>[]>)) {
      const table = TABLES[tableName];
      for (const input of rows) {
        const row = prepareInsertRow(tableName, table, input);
        const cols = Object.keys(row);
        await conn.query(
          `INSERT IGNORE INTO ${q(tableName)} (${cols.map(q).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
          cols.map((c) => row[c]),
        );
      }
    }
    await setMeta(conn, "initial_data", new Date().toISOString());
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  }
}

export async function installSchema(pool: Pool): Promise<{ migrated: boolean; seeded: boolean }> {
  const conn = await pool.getConnection();
  try {
    const [lock] = await conn.query<Rows>("SELECT GET_LOCK(?, 60) AS ok", [LOCK]);
    if (Number(lock[0]?.ok) !== 1) throw new Error("Another server is still preparing the database. Try again in a minute.");
    try {
      const fingerprint = schemaFingerprint(TABLES);
      let meta = await readMeta(conn);
      let migrated = false;
      if (meta.get("schema_fingerprint") !== fingerprint) {
        await migrate(conn);
        await setMeta(conn, "schema_fingerprint", fingerprint);
        migrated = true;
        meta = await readMeta(conn);
      }
      let seeded = false;
      if (!meta.has("initial_data")) {
        await loadInitialData(conn);
        seeded = true;
      }
      return { migrated, seeded };
    } finally {
      await conn.query("SELECT RELEASE_LOCK(?)", [LOCK]).catch(() => undefined);
    }
  } finally {
    conn.release();
  }
}

const globalForInstall = globalThis as unknown as { __unarInstall?: Promise<void>; __unarInstallFailedAt?: number };

/**
 * Returns the connection pool once the tables are ready. Every database call
 * goes through here, so the first visitor after a deploy triggers the setup.
 */
export async function getReadyPool(): Promise<Pool> {
  const pool = getPool();
  if (!pool) throw new DatabaseNotConfiguredError();
  if (!globalForInstall.__unarInstall) {
    const failedAt = globalForInstall.__unarInstallFailedAt ?? 0;
    if (Date.now() - failedAt < 5_000) throw new Error("The database is not reachable right now. It will be retried shortly.");
    globalForInstall.__unarInstall = installSchema(pool).then(
      (result) => {
        if (result.migrated || result.seeded) console.info("[db] database prepared", result);
      },
      (error) => {
        globalForInstall.__unarInstall = undefined;
        globalForInstall.__unarInstallFailedAt = Date.now();
        console.error("[db] could not prepare the database:", (error as Error).message);
        throw error;
      },
    );
  }
  await globalForInstall.__unarInstall;
  return pool;
}
