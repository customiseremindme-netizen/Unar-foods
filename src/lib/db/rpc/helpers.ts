import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Permission } from "@/lib/auth/permissions";
import { q } from "../ddl";
import { withTransaction, type Conn } from "../pool";
import { prepareInsertRow } from "../rows";
import { TABLES } from "../schema";
import { fromDb } from "../values";
import { forbidden, hasPerm, type DbContext } from "../rest/context";

/** Shared helpers for the commerce functions (each runs in one transaction with row locks). */

export function requirePerm(ctx: DbContext, perm: Permission) {
  if (!hasPerm(ctx, perm)) forbidden(`FORBIDDEN: missing permission ${perm}`);
}

export function requireService(ctx: DbContext) {
  if (ctx.kind !== "service") forbidden("FORBIDDEN");
}

export function requireStaff(ctx: DbContext) {
  if (ctx.kind === "service") return;
  if (ctx.kind !== "user" || !ctx.isStaff) forbidden("FORBIDDEN");
}

export const actorId = (ctx: DbContext): string | null => (ctx.kind === "user" ? ctx.userId : null);

export function tx<T>(pool: Pool, fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  return withTransaction(pool, fn);
}

export async function all<T = RowDataPacket>(conn: Conn, sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await conn.query<RowDataPacket[]>(sql, params);
  return rows as T[];
}

export async function one<T = RowDataPacket>(conn: Conn, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await all<T>(conn, sql, params))[0];
}

export async function exec(conn: Conn, sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await conn.query<ResultSetHeader>(sql, params);
  return result;
}

/** Inserts one row with the same defaults/conversions as the data API. Returns its id. */
export async function insertRow(conn: Conn, table: string, input: Record<string, unknown>): Promise<string | number> {
  const def = TABLES[table];
  const row = prepareInsertRow(table, def, input);
  const cols = Object.keys(row);
  const result = await exec(conn, `INSERT INTO ${q(table)} (${cols.map(q).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map((c) => row[c]));
  const pk = def.primaryKey[0];
  return def.columns[pk].type === "serial" ? result.insertId : (row[pk] as string);
}

/** Converts raw MySQL values of a table's row (booleans, JSON, dates) to app values. */
export function decode<T = Record<string, unknown>>(table: string, row: RowDataPacket | undefined): T | undefined {
  if (!row) return undefined;
  const def = TABLES[table];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[key] = def.columns[key] ? fromDb(def.columns[key], value) : value;
  return out as T;
}

export const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));
export const int = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
export const bool = (v: unknown, fallback = false): boolean => (v === null || v === undefined ? fallback : v === true || v === "true" || v === 1);
export const left = (v: unknown, n: number): string | null => (v === null || v === undefined ? null : String(v).slice(0, n));

/** Adds a line to an order's timeline. */
export async function orderEvent(conn: Conn, orderId: string, type: string, message: string, visibility: "customer" | "internal", actor: string | null) {
  await insertRow(conn, "order_events", { order_id: orderId, type, message: message.slice(0, 1000), visibility, actor_id: actor });
}

/** Returns all reserved items of an order to stock (with an inventory history line each). */
export async function restockOrderItems(conn: Conn, orderId: string, reason: string, note: string, actor: string | null) {
  const items = await all(
    conn,
    "SELECT variant_id, SUM(quantity) AS quantity FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL GROUP BY variant_id ORDER BY variant_id",
    [orderId],
  );
  for (const item of items) {
    const qty = Number(item.quantity);
    const variant = await one(conn, "SELECT stock FROM product_variants WHERE id = ? FOR UPDATE", [item.variant_id]);
    if (!variant) continue;
    await exec(conn, "UPDATE product_variants SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [qty, item.variant_id]);
    await insertRow(conn, "inventory_movements", {
      variant_id: item.variant_id,
      delta: qty,
      stock_after: Number(variant.stock) + qty,
      reason,
      order_id: orderId,
      note,
      actor_id: actor,
    });
  }
}

/** Empties the cart an order was placed from (after payment / COD placement). */
export async function clearOrderCart(conn: Conn, orderId: string) {
  const order = await one(conn, "SELECT cart_id FROM orders WHERE id = ?", [orderId]);
  if (!order?.cart_id) return;
  await exec(conn, "DELETE FROM cart_items WHERE cart_id = ?", [order.cart_id]);
  await exec(
    conn,
    "UPDATE carts SET status = 'converted', coupon_code = NULL, active_user_key = NULL, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND status = 'active'",
    [order.cart_id],
  );
}
