import { createHash } from "node:crypto";
import type { Column, Table } from "./schema";

/**
 * Turns the table definitions in schema.ts into MySQL / MariaDB statements.
 * Works on MySQL 8.0+ and MariaDB 10.5+ (what Hostinger provides).
 */

export const q = (name: string) => `\`${name.replace(/`/g, "``")}\``;

function literal(value: string | number | boolean | null): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

const UUID_TYPE = "CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci";

/** SQL type for a column (without NULL / DEFAULT). */
export function sqlType(col: Column): string {
  switch (col.type) {
    case "uuid":
      return UUID_TYPE;
    case "string":
      return `VARCHAR(${col.length ?? 255})`;
    case "text":
      return col.medium ? "MEDIUMTEXT" : "TEXT";
    case "int":
      return "INT";
    case "bigint":
      return "BIGINT";
    case "serial":
      return "BIGINT";
    case "bool":
      return "TINYINT(1)";
    case "json":
      return "JSON";
    case "datetime":
      return "DATETIME(3)";
    case "decimal":
      return "DECIMAL(5,2)";
    case "blob":
      return "LONGBLOB";
  }
}

/** Full column definition, e.g. "`stock` INT NOT NULL DEFAULT 0". */
export function columnSql(name: string, col: Column): string {
  const parts = [q(name), sqlType(col)];
  if (col.type === "serial") {
    parts.push("NOT NULL AUTO_INCREMENT");
    return parts.join(" ");
  }
  const nullable = col.nullable === true;
  parts.push(nullable ? "NULL" : "NOT NULL");
  if (col.now === "insert") parts.push("DEFAULT CURRENT_TIMESTAMP(3)");
  else if (col.now === "insert_update") parts.push("DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)");
  else if (col.default !== undefined && !["text", "json", "blob"].includes(col.type)) parts.push(`DEFAULT ${literal(col.default)}`);
  else if (nullable && !["text", "json", "blob"].includes(col.type)) parts.push("DEFAULT NULL");
  return parts.join(" ");
}

/** Index / constraint names are limited to 64 characters. */
export function keyName(prefix: "uq" | "ix" | "fk" | "ck", table: string, cols: string[] | string): string {
  const base = `${prefix}_${table}_${Array.isArray(cols) ? cols.join("_") : cols}`;
  if (base.length <= 64) return base;
  const hash = createHash("sha1").update(base).digest("hex").slice(0, 8);
  return `${base.slice(0, 55)}_${hash}`;
}

export function allColumns(table: Table): [string, Column][] {
  const cols = Object.entries(table.columns);
  for (const d of table.derived ?? []) cols.push([d.name, d.column]);
  return cols;
}

/** CREATE TABLE without foreign keys (those are added once every table exists). */
export function createTableSql(name: string, table: Table): string {
  const lines = allColumns(table).map(([col, def]) => `  ${columnSql(col, def)}`);
  lines.push(`  PRIMARY KEY (${table.primaryKey.map(q).join(", ")})`);
  for (const cols of table.unique ?? []) lines.push(`  UNIQUE KEY ${q(keyName("uq", name, cols))} (${cols.map(q).join(", ")})`);
  for (const cols of table.indexes ?? []) lines.push(`  KEY ${q(keyName("ix", name, cols))} (${cols.map(q).join(", ")})`);
  (table.checks ?? []).forEach((check, i) => lines.push(`  CONSTRAINT ${q(keyName("ck", name, String(i + 1)))} CHECK (${check})`));
  return `CREATE TABLE IF NOT EXISTS ${q(name)} (\n${lines.join(",\n")}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
}

export type ForeignKey = { name: string; table: string; column: string; refTable: string; refColumn: string; onDelete: string };

export function foreignKeys(name: string, table: Table): ForeignKey[] {
  return Object.entries(table.columns)
    .filter(([, col]) => col.references)
    .map(([column, col]) => ({
      name: keyName("fk", name, column),
      table: name,
      column,
      refTable: col.references!.table,
      refColumn: col.references!.column,
      onDelete: col.references!.onDelete.toUpperCase(),
    }));
}

export function addForeignKeySql(fk: ForeignKey): string {
  return `ALTER TABLE ${q(fk.table)} ADD CONSTRAINT ${q(fk.name)} FOREIGN KEY (${q(fk.column)}) REFERENCES ${q(fk.refTable)} (${q(fk.refColumn)}) ON DELETE ${fk.onDelete}`;
}

/** A fingerprint of the whole definition: the installer only works when it changes. */
export function schemaFingerprint(tables: Record<string, Table>): string {
  const plain = Object.entries(tables).map(([name, t]) => [
    name,
    allColumns(t).map(([c, def]) => columnSql(c, def)),
    t.primaryKey,
    t.unique ?? [],
    t.indexes ?? [],
    t.checks ?? [],
    foreignKeys(name, t).map(addForeignKeySql),
  ]);
  return createHash("sha256").update(JSON.stringify(plain)).digest("hex").slice(0, 32);
}
