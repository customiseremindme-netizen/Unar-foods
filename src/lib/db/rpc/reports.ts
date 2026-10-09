import type { Pool } from "mysql2/promise";
import { type DbContext } from "../rest/context";
import { fromSqlDateTime, toSqlDateTime } from "../values";
import { all, int, one, requirePerm } from "./helpers";

/**
 * Reports for the owner/admin. All amounts are in paise. Days are India
 * time (UTC+05:30). Revenue is counted when payment is received (paid_at).
 */

const PAID = "('paid', 'partially_refunded', 'refunded', 'cod_collected')";
const IST = "INTERVAL 330 MINUTE";

function range(args: Record<string, unknown>): [string, string] {
  return [toSqlDateTime(args.p_from) ?? "1970-01-01 00:00:00.000", toSqlDateTime(args.p_to) ?? "2999-01-01 00:00:00.000"];
}

export async function report_summary(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "reports.view");
  const [from, to] = range(args);
  const paid = await one(
    pool,
    `SELECT COUNT(*) AS n, COALESCE(SUM(total_paise), 0) AS gross, COALESCE(SUM(discount_paise), 0) AS discounts,
            COALESCE(SUM(shipping_paise), 0) AS shipping
       FROM orders WHERE paid_at >= ? AND paid_at < ? AND payment_status IN ${PAID}`,
    [from, to],
  );
  const refunds = await one(pool, "SELECT COALESCE(SUM(amount_paise), 0) AS s FROM refunds WHERE created_at >= ? AND created_at < ? AND status <> 'failed'", [from, to]);
  const live = await one(
    pool,
    `SELECT
       SUM(status = 'placed' AND fulfillment_status IN ('unfulfilled', 'processing', 'packed') AND payment_status IN ('paid', 'partially_refunded', 'cod_pending')) AS to_fulfil,
       SUM(status = 'pending_payment') AS awaiting,
       SUM(status = 'placed' AND payment_status = 'cod_pending') AS cod_n,
       COALESCE(SUM(IF(status = 'placed' AND payment_status = 'cod_pending', total_paise, 0)), 0) AS cod_paise,
       SUM(needs_attention = 1) AS attention
     FROM orders`,
  );
  const low = await one(pool, "SELECT COUNT(*) AS n FROM product_variants WHERE is_active = 1 AND stock <= low_stock_threshold");
  const customers = await one(pool, "SELECT COUNT(*) AS n FROM profiles WHERE created_at >= ? AND created_at < ?", [from, to]);
  const n = (v: unknown) => Number(v ?? 0);
  return {
    paid_orders: n(paid?.n),
    gross_revenue_paise: n(paid?.gross),
    refunds_paise: n(refunds?.s),
    discounts_paise: n(paid?.discounts),
    shipping_collected_paise: n(paid?.shipping),
    orders_to_fulfil: n(live?.to_fulfil),
    awaiting_payment: n(live?.awaiting),
    cod_pending_orders: n(live?.cod_n),
    cod_pending_paise: n(live?.cod_paise),
    needs_attention: n(live?.attention),
    low_stock_variants: n(low?.n),
    new_customers: n(customers?.n),
  };
}

/** India date (YYYY-MM-DD) of a moment. */
function istDay(ms: number): string {
  return new Date(ms + 330 * 60_000).toISOString().slice(0, 10);
}

export async function report_daily_sales(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "reports.view");
  const [from, to] = range(args);
  const paid = await all(
    pool,
    `SELECT DATE_FORMAT(paid_at + ${IST}, '%Y-%m-%d') AS day, SUM(total_paise) AS revenue, COUNT(*) AS n
       FROM orders WHERE paid_at >= ? AND paid_at < ? AND payment_status IN ${PAID} GROUP BY day`,
    [from, to],
  );
  const refunds = await all(
    pool,
    `SELECT DATE_FORMAT(created_at + ${IST}, '%Y-%m-%d') AS day, SUM(amount_paise) AS refunded
       FROM refunds WHERE created_at >= ? AND created_at < ? AND status <> 'failed' GROUP BY day`,
    [from, to],
  );
  const paidByDay = new Map(paid.map((r) => [String(r.day), r]));
  const refundsByDay = new Map(refunds.map((r) => [String(r.day), Number(r.refunded)]));
  const start = Date.parse(`${from.replace(" ", "T")}Z`);
  const end = Date.parse(`${to.replace(" ", "T")}Z`) - 1000;
  const days: { day: string; revenue_paise: number; orders: number; refunds_paise: number }[] = [];
  const last = istDay(end);
  for (let day = istDay(start), guard = 0; day <= last && guard < 1000; guard++) {
    const p = paidByDay.get(day);
    days.push({ day, revenue_paise: Number(p?.revenue ?? 0), orders: Number(p?.n ?? 0), refunds_paise: refundsByDay.get(day) ?? 0 });
    day = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  }
  return days;
}

export async function report_product_sales(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "reports.view");
  const [from, to] = range(args);
  const rows = await all(
    pool,
    `SELECT oi.product_id, MAX(oi.title) AS title, oi.sku, SUM(oi.quantity) AS units, SUM(oi.line_total_paise) AS revenue_paise
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.paid_at >= ? AND o.paid_at < ? AND o.payment_status IN ${PAID}
      GROUP BY oi.product_id, oi.sku
      ORDER BY revenue_paise DESC`,
    [from, to],
  );
  return rows.map((r) => ({ product_id: r.product_id, title: r.title, sku: r.sku, units: Number(r.units), revenue_paise: Number(r.revenue_paise) }));
}

export async function report_coupon_usage(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "reports.view");
  const [from, to] = range(args);
  const rows = await all(
    pool,
    `SELECT coupon_code AS code, COUNT(*) AS uses, SUM(discount_paise) AS discount_paise, SUM(total_paise) AS revenue_paise
       FROM orders
      WHERE coupon_code IS NOT NULL AND paid_at >= ? AND paid_at < ? AND payment_status IN ${PAID}
      GROUP BY coupon_code ORDER BY uses DESC`,
    [from, to],
  );
  return rows.map((r) => ({ code: r.code, uses: Number(r.uses), discount_paise: Number(r.discount_paise), revenue_paise: Number(r.revenue_paise) }));
}

/** Customers: registered accounts and guest checkouts, with spend totals. */
export async function admin_customers(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "customers.read");
  const search = String(args.p_search ?? "").trim();
  const like = `%${search}%`;
  const limit = Math.max(1, Math.min(int(args.p_limit) ?? 50, 200));
  const offset = Math.max(0, int(args.p_offset) ?? 0);
  const rows = await all(
    pool,
    `WITH guests AS (
       SELECT LOWER(o.email) AS email, o.customer_name AS full_name, o.phone, o.created_at, o.marketing_consent,
              ROW_NUMBER() OVER (PARTITION BY LOWER(o.email) ORDER BY o.created_at DESC) AS rn
         FROM orders o
        WHERE NOT EXISTS (SELECT 1 FROM profiles p2 WHERE LOWER(p2.email) = LOWER(o.email))
     ),
     people AS (
       SELECT LOWER(p.email) AS email, p.full_name, p.phone, p.id AS user_id, 1 AS is_registered, p.created_at, p.marketing_consent
         FROM profiles p WHERE p.email IS NOT NULL
       UNION ALL
       SELECT email, full_name, phone, NULL, 0, created_at, marketing_consent FROM guests WHERE rn = 1
     ),
     stats AS (
       SELECT LOWER(o.email) AS email,
              SUM(o.status IN ('placed', 'cancelled')) AS orders_count,
              SUM(o.payment_status IN ${PAID}) AS paid_orders,
              COALESCE(SUM(IF(o.payment_status IN ${PAID}, o.total_paise - o.refunded_paise, 0)), 0) AS spent,
              MAX(o.created_at) AS last_order_at
         FROM orders o GROUP BY LOWER(o.email)
     ),
     filtered AS (
       SELECT pe.email, pe.full_name, pe.phone, pe.user_id, pe.is_registered, pe.created_at, pe.marketing_consent,
              COALESCE(s.orders_count, 0) AS orders_count, COALESCE(s.paid_orders, 0) AS paid_orders,
              COALESCE(s.spent, 0) AS spent, s.last_order_at
         FROM people pe LEFT JOIN stats s ON s.email = pe.email
        WHERE ? = '' OR pe.email LIKE ? OR pe.full_name LIKE ? OR pe.phone LIKE ?
     )
     SELECT f.*, COUNT(*) OVER () AS total_count
       FROM filtered f
      ORDER BY f.last_order_at IS NULL, f.last_order_at DESC, f.created_at DESC
      LIMIT ? OFFSET ?`,
    [search, like, like, like, limit, offset],
  );
  return rows.map((r) => ({
    email: r.email,
    full_name: r.full_name ?? null,
    phone: r.phone ?? null,
    user_id: r.user_id ?? null,
    is_registered: Number(r.is_registered) === 1,
    orders_count: Number(r.orders_count),
    paid_orders: Number(r.paid_orders),
    total_spent_paise: Number(r.spent),
    last_order_at: fromSqlDateTime(r.last_order_at),
    created_at: fromSqlDateTime(r.created_at),
    marketing_consent: Number(r.marketing_consent) === 1,
    total_count: Number(r.total_count),
  }));
}
