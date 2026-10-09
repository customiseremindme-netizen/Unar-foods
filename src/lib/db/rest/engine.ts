import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { q } from "../ddl";
import { prepareInsertRow, prepareUpdate, UnknownColumnError } from "../rows";
import { TABLES, type Column, type Table } from "../schema";
import { DbValueError, filterValue, fromDb } from "../values";
import { DbError, forbidden, type DbContext } from "./context";
import type { Filter, OrderTerm, ParsedQuery, SelectNode } from "./parse";
import { readAccess, RULES, type Access, type Cond } from "./policies";

/**
 * Runs data API requests against MySQL / MariaDB with the access rules in
 * policies.ts. Identifiers are only ever taken from schema.ts (never from the
 * request) and every value is sent as a query parameter.
 */

export type Executor = Pool | PoolConnection;

async function select(ex: Executor, sql: string, params: unknown[]): Promise<RowDataPacket[]> {
  const [rows] = await ex.query<RowDataPacket[]>(sql, params);
  return rows;
}

export function tableDef(name: string): Table {
  const table = TABLES[name];
  if (!table) throw new DbError("PGRST205", `Could not find the table 'public.${name}' in the schema cache`, 404);
  return table;
}

function columnDef(tableName: string, table: Table, column: string): Column {
  const def = table.columns[column];
  if (!def || def.hidden) throw new DbError("42703", `column ${tableName}.${column} does not exist`, 400);
  return def;
}

const col = (alias: string, column: string) => `${alias}.${q(column)}`;

// ---------------------------------------------------------------------------
// Relationships (from the foreign keys in schema.ts)
// ---------------------------------------------------------------------------

export type Relation = { table: string; one: boolean; local: string; foreign: string };

export function resolveRelation(from: string, rel: string, hint?: string): Relation {
  const fromTable = tableDef(from);
  const relTable = tableDef(rel);
  const candidates: (Relation & { fk: string })[] = [];
  for (const [name, def] of Object.entries(fromTable.columns)) {
    if (def.references?.table === rel) candidates.push({ table: rel, one: true, local: name, foreign: def.references.column, fk: name });
  }
  if (from !== rel) {
    for (const [name, def] of Object.entries(relTable.columns)) {
      if (def.references?.table !== from) continue;
      const unique =
        (relTable.primaryKey.length === 1 && relTable.primaryKey[0] === name) ||
        (relTable.unique ?? []).some((u) => u.length === 1 && u[0] === name);
      candidates.push({ table: rel, one: unique, local: def.references.column, foreign: name, fk: name });
    }
  }
  const matches = hint ? candidates.filter((c) => c.fk === hint || c.local === hint) : candidates;
  if (matches.length === 1) return matches[0];
  if (!matches.length) throw new DbError("PGRST200", `Could not find a relationship between '${from}' and '${rel}' in the schema cache`, 400);
  throw new DbError("PGRST201", `Could not embed because more than one relationship was found for '${from}' and '${rel}'`, 300);
}

// ---------------------------------------------------------------------------
// WHERE clauses
// ---------------------------------------------------------------------------

class Where {
  parts: string[] = [];
  params: unknown[] = [];
  add(cond: Access | Cond) {
    if (cond === true) return;
    if (cond === false) {
      this.parts.push("1 = 0");
      return;
    }
    this.parts.push(`(${cond.sql})`);
    this.params.push(...cond.params);
  }
  sql() {
    return this.parts.length ? ` WHERE ${this.parts.join(" AND ")}` : "";
  }
}

function conditionSql(tableName: string, table: Table, alias: string, f: Filter): Cond {
  if (f.kind !== "cond") {
    const parts = f.items.map((item) => conditionSql(tableName, table, alias, item));
    const joined = parts.length ? parts.map((p) => `(${p.sql})`).join(f.kind === "or" ? " OR " : " AND ") : f.kind === "or" ? "1 = 0" : "1 = 1";
    return { sql: f.negate ? `NOT (${joined})` : joined, params: parts.flatMap((p) => p.params) };
  }
  const def = columnDef(tableName, table, f.column);
  const ref = col(alias, f.column);
  let sql = "";
  let params: unknown[] = [];
  const value = f.value;
  switch (f.op) {
    case "eq":
    case "neq":
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const sym = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[f.op];
      if (def.type === "json") throw new DbError("42883", `operator does not exist for JSON column ${f.column}`, 400);
      sql = `${ref} ${sym} ?`;
      params = [filterValue(def, value as string)];
      break;
    }
    case "like":
      sql = `CAST(${ref} AS BINARY) LIKE CAST(? AS BINARY)`;
      params = [value];
      break;
    case "ilike":
      sql = `LOWER(${ref}) LIKE LOWER(?)`;
      params = [value];
      break;
    case "is": {
      const v = String(value).toLowerCase();
      if (v === "null") sql = `${ref} IS NULL`;
      else if (v === "true") sql = `${ref} = 1`;
      else if (v === "false") sql = `${ref} = 0`;
      else if (v === "unknown") sql = `${ref} IS NULL`;
      else throw new DbError("PGRST100", `Invalid "is" value "${value}"`, 400);
      break;
    }
    case "in": {
      const list = value as string[];
      if (!list.length) {
        sql = "1 = 0";
      } else {
        sql = `${ref} IN (?)`;
        params = [list.map((v) => filterValue(def, v))];
      }
      break;
    }
  }
  return { sql: f.negate ? `NOT (${sql})` : sql, params };
}

function filtersSql(tableName: string, table: Table, alias: string, filters: Filter[] | undefined): Cond[] {
  return (filters ?? []).map((f) => conditionSql(tableName, table, alias, f));
}

function orderSql(tableName: string, table: Table, alias: string, terms: OrderTerm[] | undefined): string {
  const parts: string[] = [];
  if (terms?.length) {
    for (const term of terms) {
      const def = columnDef(tableName, table, term.column);
      const ref = col(alias, term.column);
      // Same NULL placement as before: ascending → empty values last, descending → first.
      const nulls = term.nulls ?? (term.ascending ? "last" : "first");
      if (def.nullable) parts.push(`${ref} IS NULL ${nulls === "last" ? "ASC" : "DESC"}`);
      parts.push(`${ref} ${term.ascending ? "ASC" : "DESC"}`);
    }
  } else {
    if (table.columns.created_at) parts.push(col(alias, "created_at"));
    for (const pk of table.primaryKey) parts.push(col(alias, pk));
  }
  return ` ORDER BY ${parts.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Reading (with embedded relations)
// ---------------------------------------------------------------------------

type Output = { kind: "col"; key: string; column: string } | { kind: "embed"; key: string; node: Extract<SelectNode, { kind: "embed" }>; rel: Relation };

function plan(tableName: string, table: Table, nodes: SelectNode[]): Output[] {
  const outputs: Output[] = [];
  for (const node of nodes) {
    if (node.kind === "star") {
      for (const [name, def] of Object.entries(table.columns)) if (!def.hidden) outputs.push({ kind: "col", key: name, column: name });
    } else if (node.kind === "column") {
      columnDef(tableName, table, node.name);
      outputs.push({ kind: "col", key: node.alias, column: node.name });
    } else {
      outputs.push({ kind: "embed", key: node.alias, node, rel: resolveRelation(tableName, node.relation, node.hint) });
    }
  }
  return outputs;
}

const keyOf = (v: unknown) => (v === null || v === undefined ? null : String(v).toLowerCase());

type LevelOptions = {
  restrict?: { column: string; values: unknown[] };
  extra?: Cond;
  limit?: number;
  offset?: number;
};

type LevelResult = { rows: Record<string, unknown>[]; restrictKeys: (string | null)[] };

function childPath(path: string, alias: string) {
  return path ? `${path}.${alias}` : alias;
}

/** Builds the WHERE for one level: access rules + filters + inner joins + restrictions. */
function levelWhere(ctx: DbContext, query: ParsedQuery, tableName: string, table: Table, alias: string, outputs: Output[], path: string, opts: LevelOptions, depth: number): Where {
  const where = new Where();
  where.add(readAccess(ctx, tableName, alias));
  for (const cond of filtersSql(tableName, table, alias, query.filters.get(path))) where.add(cond);
  for (const out of outputs) {
    if (out.kind !== "embed" || !out.node.inner) continue;
    const childAlias = `e${depth}`;
    const childTable = tableDef(out.rel.table);
    const inner = new Where();
    inner.add({ sql: `${col(childAlias, out.rel.foreign)} = ${col(alias, out.rel.local)}`, params: [] });
    inner.add(readAccess(ctx, out.rel.table, childAlias));
    for (const cond of filtersSql(out.rel.table, childTable, childAlias, query.filters.get(childPath(path, out.key)))) inner.add(cond);
    where.add({ sql: `EXISTS (SELECT 1 FROM ${q(out.rel.table)} ${childAlias}${inner.sql()})`, params: inner.params });
  }
  if (opts.restrict) {
    if (!opts.restrict.values.length) where.add(false);
    else where.add({ sql: `${col(alias, opts.restrict.column)} IN (?)`, params: [opts.restrict.values] });
  }
  if (opts.extra) where.add(opts.extra);
  return where;
}

async function fetchLevel(
  ex: Executor,
  ctx: DbContext,
  query: ParsedQuery,
  tableName: string,
  nodes: SelectNode[],
  path: string,
  opts: LevelOptions,
  depth = 0,
): Promise<LevelResult> {
  if (depth > 6) throw new DbError("PGRST100", "Embedding is nested too deeply", 400);
  const table = tableDef(tableName);
  const alias = `t${depth}`;
  const outputs = plan(tableName, table, nodes);

  const needed = new Set<string>();
  for (const out of outputs) {
    if (out.kind === "col") needed.add(out.column);
    else needed.add(out.rel.local);
  }
  if (opts.restrict) needed.add(opts.restrict.column);
  if (!needed.size) needed.add(table.primaryKey[0]);
  const columns = [...needed];

  const where = levelWhere(ctx, query, tableName, table, alias, outputs, path, opts, depth);
  let sql = `SELECT ${columns.map((c) => col(alias, c)).join(", ")} FROM ${q(tableName)} ${alias}${where.sql()}`;
  sql += orderSql(tableName, table, alias, query.order.get(path));
  const params = [...where.params];
  if (opts.limit !== undefined) {
    sql += " LIMIT ?";
    params.push(opts.limit);
    if (opts.offset) {
      sql += " OFFSET ?";
      params.push(opts.offset);
    }
  } else if (opts.offset) {
    sql += " LIMIT 18446744073709551615 OFFSET ?";
    params.push(opts.offset);
  }

  const raw = await select(ex, sql, params);
  const values = raw.map((r) => {
    const v: Record<string, unknown> = {};
    for (const c of columns) v[c] = fromDb(table.columns[c], r[c]);
    return v;
  });

  // Fetch each embedded relation for all rows at once.
  const embedded = new Map<string, Map<string | null, Record<string, unknown>[]>>();
  for (const out of outputs) {
    if (out.kind !== "embed") continue;
    const keys = [...new Set(values.map((v) => v[out.rel.local]).filter((v) => v !== null && v !== undefined))];
    const groups = new Map<string | null, Record<string, unknown>[]>();
    if (keys.length) {
      const child = await fetchLevel(ex, ctx, query, out.rel.table, out.node.children, childPath(path, out.key), { restrict: { column: out.rel.foreign, values: keys } }, depth + 1);
      child.rows.forEach((row, i) => {
        const k = child.restrictKeys[i];
        const list = groups.get(k);
        if (list) list.push(row);
        else groups.set(k, [row]);
      });
    }
    embedded.set(out.key, groups);
  }

  const rows: Record<string, unknown>[] = [];
  const restrictKeys: (string | null)[] = [];
  for (const v of values) {
    const row: Record<string, unknown> = {};
    let keep = true;
    for (const out of outputs) {
      if (out.kind === "col") {
        row[out.key] = v[out.column];
        continue;
      }
      const group = embedded.get(out.key)!.get(keyOf(v[out.rel.local])) ?? [];
      const p = childPath(path, out.key);
      if (out.rel.one) {
        row[out.key] = group[0] ?? null;
        if (out.node.inner && !group.length) keep = false;
      } else {
        const offset = query.offset.get(p) ?? 0;
        const limit = query.limit.get(p);
        const list = group.slice(offset, limit === undefined ? undefined : offset + limit);
        row[out.key] = list;
        if (out.node.inner && !list.length) keep = false;
      }
    }
    if (!keep) continue;
    rows.push(row);
    restrictKeys.push(opts.restrict ? keyOf(v[opts.restrict.column]) : null);
  }
  return { rows, restrictKeys };
}

export type ReadResult = { rows: Record<string, unknown>[]; count: number | null; offset: number };

export async function readRows(ex: Executor, ctx: DbContext, tableName: string, query: ParsedQuery, wantCount: boolean, extra?: Cond): Promise<ReadResult> {
  const offset = query.offset.get("") ?? 0;
  const result = await fetchLevel(ex, ctx, query, tableName, query.select, "", { limit: query.limit.get(""), offset, extra });
  let count: number | null = null;
  if (wantCount) {
    const table = tableDef(tableName);
    const outputs = plan(tableName, table, query.select);
    const where = levelWhere(ctx, query, tableName, table, "t0", outputs, "", { extra }, 0);
    const [row] = await select(ex, `SELECT COUNT(*) AS n FROM ${q(tableName)} t0${where.sql()}`, where.params);
    count = Number(row?.n ?? 0);
  }
  return { rows: result.rows, count, offset };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export type Prefer = { returnRepresentation: boolean; resolution?: "merge" | "ignore"; count?: boolean };

function rules(tableName: string) {
  return RULES[tableName] ?? {};
}

function rlsDenied(tableName: string): never {
  forbidden(`new row violates row-level security policy for table "${tableName}"`);
}

function identityCond(alias: string, columns: string[], rows: Record<string, unknown>[]): Cond {
  if (!rows.length) return { sql: "1 = 0", params: [] };
  if (columns.length === 1) return { sql: `${col(alias, columns[0])} IN (?)`, params: [rows.map((r) => r[columns[0]])] };
  return {
    sql: rows.map(() => `(${columns.map((c) => `${col(alias, c)} = ?`).join(" AND ")})`).join(" OR "),
    params: rows.flatMap((r) => columns.map((c) => r[c])),
  };
}

function wrapValueErrors<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof UnknownColumnError) throw new DbError("PGRST204", error.message, 400);
    if (error instanceof DbValueError) throw new DbError("22P02", error.message, 400);
    throw error;
  }
}

/** Last-owner rule: the store must always keep at least one owner. */
async function guardLastOwner(conn: PoolConnection, affected: RowDataPacket[], newRole: unknown, deleting: boolean) {
  const losing = affected.filter((r) => r.role === "owner" && (deleting || (newRole !== undefined && newRole !== "owner")));
  if (!losing.length) return;
  const [row] = await select(conn, "SELECT COUNT(*) AS n FROM staff_members WHERE role = 'owner' AND user_id NOT IN (?) FOR UPDATE", [losing.map((r) => r.user_id)]);
  if (Number(row?.n ?? 0) === 0) throw new DbError("P0001", "LAST_OWNER", 400);
}

export async function insertRows(
  conn: PoolConnection,
  ctx: DbContext,
  tableName: string,
  body: unknown,
  query: ParsedQuery,
  prefer: Prefer,
): Promise<Record<string, unknown>[]> {
  const table = tableDef(tableName);
  const input = Array.isArray(body) ? body : [body];
  if (!input.every((r) => r && typeof r === "object" && !Array.isArray(r))) throw new DbError("PGRST102", "Invalid body", 400);
  const rowsIn = input as Record<string, unknown>[];

  if (ctx.kind !== "service") {
    const rule = rules(tableName);
    if (ctx.kind === "anon" || !rule.insert) forbidden(`permission denied for table ${tableName}`);
    for (const row of rowsIn) if (!rule.insert(ctx, row)) rlsDenied(tableName);
    if (prefer.resolution === "merge" && rule.update?.(ctx, "t") !== true) forbidden(`permission denied for table ${tableName}`);
  }

  const conflict = query.onConflict?.length ? query.onConflict : table.primaryKey;
  for (const c of conflict) columnDef(tableName, table, c);
  const identityColumns = prefer.resolution ? conflict : table.primaryKey;
  const identities: Record<string, unknown>[] = [];

  for (const input of rowsIn) {
    const row = wrapValueErrors(() => prepareInsertRow(tableName, table, input));
    const cols = Object.keys(row);
    let sql = `INSERT INTO ${q(tableName)} (${cols.map(q).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
    const params = cols.map((c) => row[c]);
    if (prefer.resolution === "merge") {
      const updates = Object.keys(input).filter((c) => input[c] !== undefined && !conflict.includes(c));
      const sets = updates.map((c) => `${q(c)} = ?`);
      params.push(...updates.map((c) => row[c]));
      if (table.columns.updated_at?.now === "insert_update" && !updates.includes("updated_at")) sets.push("`updated_at` = CURRENT_TIMESTAMP(3)");
      for (const d of table.derived ?? []) sets.push(`${q(d.name)} = ${d.sql}`);
      if (!sets.length) sets.push(`${q(conflict[0])} = ${q(conflict[0])}`);
      sql += ` ON DUPLICATE KEY UPDATE ${sets.join(", ")}`;
    } else if (prefer.resolution === "ignore") {
      sql += ` ON DUPLICATE KEY UPDATE ${q(conflict[0])} = ${q(conflict[0])}`;
    }
    const [result] = await conn.query<ResultSetHeader>(sql, params);
    const identity: Record<string, unknown> = {};
    for (const c of identityColumns) {
      identity[c] = table.columns[c].type === "serial" && row[c] === undefined ? result.insertId : row[c];
    }
    identities.push(identity);
  }

  if (!prefer.returnRepresentation) return [];
  const { rows } = await readRows(conn, ctx, tableName, { ...query, filters: new Map(), order: new Map(), limit: new Map(), offset: new Map() }, false, identityCond("t0", identityColumns, identities));
  return rows;
}

async function lockTargets(conn: PoolConnection, ctx: DbContext, tableName: string, table: Table, query: ParsedQuery, access: Access, extraCols: string[]) {
  const where = new Where();
  where.add(access === true ? true : access);
  for (const cond of filtersSql(tableName, table, "t0", query.filters.get(""))) where.add(cond);
  const cols = [...new Set([...table.primaryKey, ...extraCols])];
  let sql = `SELECT ${cols.map((c) => col("t0", c)).join(", ")} FROM ${q(tableName)} t0${where.sql()}`;
  const params = [...where.params];
  if (query.order.get("")) sql += orderSql(tableName, table, "t0", query.order.get(""));
  if (query.limit.get("") !== undefined) {
    sql += " LIMIT ?";
    params.push(query.limit.get(""));
  }
  return select(conn, `${sql} FOR UPDATE`, params);
}

function writeAccess(ctx: DbContext, tableName: string, kind: "update" | "delete"): Access {
  if (ctx.kind === "service") return true;
  const rule = rules(tableName)[kind];
  if (ctx.kind === "anon" || !rule) forbidden(`permission denied for table ${tableName}`);
  const access = rule(ctx, "t0");
  if (access === false) forbidden(`permission denied for table ${tableName}`);
  return access;
}

export async function updateRows(
  conn: PoolConnection,
  ctx: DbContext,
  tableName: string,
  body: unknown,
  query: ParsedQuery,
  prefer: Prefer,
): Promise<Record<string, unknown>[]> {
  const table = tableDef(tableName);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new DbError("PGRST102", "Invalid body", 400);
  const input = body as Record<string, unknown>;
  const access = writeAccess(ctx, tableName, "update");
  if (ctx.kind !== "service" && rules(tableName).updateCheck && !rules(tableName).updateCheck!(ctx, input)) rlsDenied(tableName);
  const patch = wrapValueErrors(() => prepareUpdate(tableName, table, input));

  const targets = await lockTargets(conn, ctx, tableName, table, query, access, tableName === "staff_members" ? ["user_id", "role"] : []);
  if (!targets.length) return [];
  if (tableName === "staff_members") await guardLastOwner(conn, targets, input.role, false);

  const sets = Object.keys(patch).map((c) => `${q(c)} = ?`);
  const params = Object.values(patch);
  if (table.columns.updated_at?.now === "insert_update" && patch.updated_at === undefined) sets.push("`updated_at` = CURRENT_TIMESTAMP(3)");
  for (const d of table.derived ?? []) sets.push(`${q(d.name)} = ${d.sql}`);
  if (sets.length) {
    const ids = identityCond("t0", table.primaryKey, targets);
    await conn.query(`UPDATE ${q(tableName)} t0 SET ${sets.map((s) => `t0.${s}`).join(", ")} WHERE ${ids.sql}`, [...params, ...ids.params]);
  }

  if (!prefer.returnRepresentation) return [];
  const keys = targets.map((t) => {
    const k: Record<string, unknown> = {};
    for (const pk of table.primaryKey) k[pk] = patch[pk] !== undefined ? patch[pk] : t[pk];
    return k;
  });
  const { rows } = await readRows(conn, ctx, tableName, { ...query, filters: new Map(), limit: new Map(), offset: new Map() }, false, identityCond("t0", table.primaryKey, keys));
  return rows;
}

export async function deleteRows(conn: PoolConnection, ctx: DbContext, tableName: string, query: ParsedQuery, prefer: Prefer): Promise<Record<string, unknown>[]> {
  const table = tableDef(tableName);
  const access = writeAccess(ctx, tableName, "delete");
  const targets = await lockTargets(conn, ctx, tableName, table, query, access, tableName === "staff_members" ? ["user_id", "role"] : []);
  if (!targets.length) return [];
  if (tableName === "staff_members") await guardLastOwner(conn, targets, undefined, true);
  const ids = identityCond("t0", table.primaryKey, targets);
  let before: Record<string, unknown>[] = [];
  if (prefer.returnRepresentation) {
    before = (await readRows(conn, { kind: "service" }, tableName, { ...query, filters: new Map(), limit: new Map(), offset: new Map() }, false, ids)).rows;
  }
  await conn.query(`DELETE t0 FROM ${q(tableName)} t0 WHERE ${ids.sql}`, ids.params);
  return before;
}
