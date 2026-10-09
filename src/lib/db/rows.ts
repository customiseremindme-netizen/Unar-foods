import { randomUUID } from "node:crypto";
import type { Table } from "./schema";
import { DbValueError, toDb } from "./values";

export class UnknownColumnError extends DbValueError {
  constructor(
    public table: string,
    public column: string,
  ) {
    super(`Could not find the '${column}' column of '${table}'`);
  }
}

/** The value a row will have for a column after insert, as far as the app can tell. */
function effectiveValue(table: Table, row: Record<string, unknown>, name: string): unknown {
  if (row[name] !== undefined) return row[name];
  const col = table.columns[name];
  return col?.default ?? null;
}

/**
 * Prepares one row for INSERT: fills generated ids and app defaults, keeps
 * derived columns in sync and converts every value for MySQL.
 */
export function prepareInsertRow(tableName: string, table: Table, input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (!table.columns[key]) throw new UnknownColumnError(tableName, key);
  }
  const filled: Record<string, unknown> = { ...input };
  for (const [name, col] of Object.entries(table.columns)) {
    if (filled[name] === undefined) {
      if (col.autoUuid) filled[name] = randomUUID();
      else if (col.appDefault) filled[name] = col.appDefault();
    }
  }
  for (const [name, col] of Object.entries(table.columns)) {
    if (filled[name] === undefined) continue;
    out[name] = toDb(col, filled[name]);
  }
  for (const d of table.derived ?? []) {
    const view: Record<string, unknown> = {};
    for (const name of Object.keys(table.columns)) view[name] = effectiveValue(table, filled, name);
    out[d.name] = d.compute(view);
  }
  return out;
}

/** Prepares a SET clause for UPDATE (values converted); derived columns are recomputed in SQL. */
export function prepareUpdate(tableName: string, table: Table, input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const col = table.columns[key];
    if (!col) throw new UnknownColumnError(tableName, key);
    if (value === undefined) continue;
    out[key] = toDb(col, value);
  }
  return out;
}
