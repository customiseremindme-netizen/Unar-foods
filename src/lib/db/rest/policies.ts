import type { Permission } from "@/lib/auth/permissions";
import { hasPerm, type DbContext } from "./context";

/**
 * Who may read and change what — applied to EVERY query made for a visitor
 * ("anon") or a signed-in user. Trusted server code ("service") skips these
 * rules because it checks permissions itself before calling the database.
 *
 * These are the same rules the store had as database row level security:
 * - visitors only see published products/content and public settings,
 * - customers only see their own profile, addresses and orders,
 * - staff see and change what their role's permissions allow.
 */

export type Cond = { sql: string; params: unknown[] };
export type Access = boolean | Cond;

export type TableRules = {
  read?: (ctx: DbContext, a: string) => Access;
  /** May this new row be inserted? (row = values as sent by the app) */
  insert?: (ctx: DbContext, row: Record<string, unknown>) => boolean;
  /** Which existing rows may be updated */
  update?: (ctx: DbContext, a: string) => Access;
  /** Are the new values allowed? (patch = values being changed) */
  updateCheck?: (ctx: DbContext, patch: Record<string, unknown>) => boolean;
  delete?: (ctx: DbContext, a: string) => Access;
};

const c = (sql: string, ...params: unknown[]): Cond => ({ sql, params });

/** Combines alternatives (any one is enough), like several permissive policies. */
export function anyOf(...parts: Access[]): Access {
  const conds: Cond[] = [];
  for (const part of parts) {
    if (part === true) return true;
    if (part !== false) conds.push(part);
  }
  if (!conds.length) return false;
  if (conds.length === 1) return conds[0];
  return { sql: conds.map((p) => `(${p.sql})`).join(" OR "), params: conds.flatMap((p) => p.params) };
}

const uid = (ctx: DbContext) => (ctx.kind === "user" ? ctx.userId : null);
const isUser = (ctx: DbContext) => ctx.kind === "user";
const perm = (ctx: DbContext, ...p: Permission[]) => isUser(ctx) && hasPerm(ctx, ...p);

/** Rows owned by the signed-in user (col = their id). */
const own = (ctx: DbContext, a: string, col = "user_id"): Access => (isUser(ctx) ? c(`${a}.\`${col}\` = ?`, uid(ctx)) : false);

const publishedProduct = (a: string, col = "product_id") =>
  c(`EXISTS (SELECT 1 FROM products pp WHERE pp.id = ${a}.\`${col}\` AND pp.status = 'published')`);

const ownOrder = (ctx: DbContext, a: string, col = "order_id"): Access =>
  isUser(ctx) ? c(`EXISTS (SELECT 1 FROM orders oo WHERE oo.id = ${a}.\`${col}\` AND oo.user_id = ?)`, uid(ctx)) : false;

/** Rules for a table fully managed by staff with one permission (read + write). */
function managedBy(p: Permission, publicRead?: (ctx: DbContext, a: string) => Access, extraRead: Permission[] = []): TableRules {
  return {
    read: (ctx, a) => anyOf(publicRead ? publicRead(ctx, a) : false, perm(ctx, p, ...extraRead)),
    insert: (ctx) => perm(ctx, p),
    update: (ctx) => perm(ctx, p),
    delete: (ctx) => perm(ctx, p),
  };
}

const readOnlyFor = (...p: Permission[]): TableRules => ({ read: (ctx) => perm(ctx, ...p) });

export const RULES: Record<string, TableRules> = {
  // Accounts are only handled by the sign-in code (service).
  auth_users: {},
  auth_sessions: {},
  auth_tokens: {},
  counters: {},
  schema_meta: {},
  rate_limits: {},

  profiles: {
    read: (ctx, a) => anyOf(own(ctx, a, "id"), perm(ctx, "customers.read", "orders.read")),
    update: (ctx, a) => own(ctx, a, "id"),
    updateCheck: (ctx, patch) => patch.id === undefined || patch.id === uid(ctx),
  },
  staff_members: {
    read: (ctx, a) => anyOf(own(ctx, a, "user_id"), perm(ctx, "staff.manage")),
    insert: (ctx) => perm(ctx, "staff.manage"),
    update: (ctx) => perm(ctx, "staff.manage"),
    delete: (ctx) => perm(ctx, "staff.manage"),
  },
  addresses: {
    read: (ctx, a) => anyOf(own(ctx, a), perm(ctx, "customers.read")),
    insert: (ctx, row) => isUser(ctx) && row.user_id === uid(ctx),
    update: (ctx, a) => own(ctx, a),
    updateCheck: (ctx, patch) => patch.user_id === undefined || patch.user_id === uid(ctx),
    delete: (ctx, a) => own(ctx, a),
  },

  categories: managedBy("products.write", (_ctx, a) => c(`${a}.is_active = 1`), ["products.read"]),
  products: managedBy("products.write", (_ctx, a) => c(`${a}.status = 'published'`), ["products.read"]),
  product_categories: managedBy("products.write", (_ctx, a) => publishedProduct(a), ["products.read"]),
  product_variants: managedBy("products.write", (_ctx, a) => anyOf(c(`${a}.is_active = 1 AND ${publishedProduct(a).sql}`)), ["products.read"]),
  product_images: managedBy("products.write", (_ctx, a) => publishedProduct(a), ["products.read"]),

  coupons: managedBy("marketing.write"),
  coupon_usages: readOnlyFor("marketing.write", "orders.read"),
  shipping_zones: managedBy("shipping.write", (_ctx, a) => c(`${a}.is_active = 1`), ["orders.read"]),

  // Carts are written only by trusted server code.
  carts: readOnlyFor("marketing.write"),
  cart_items: readOnlyFor("marketing.write"),

  orders: {
    read: (ctx, a) => anyOf(own(ctx, a), perm(ctx, "orders.read")),
    update: (ctx) => perm(ctx, "orders.write"),
  },
  order_items: { read: (ctx, a) => anyOf(ownOrder(ctx, a), perm(ctx, "orders.read")) },
  order_events: {
    read: (ctx, a) => {
      const mine = ownOrder(ctx, a);
      return anyOf(mine === false ? false : c(`${a}.visibility = 'customer' AND ${(mine as Cond).sql}`, ...(mine as Cond).params), perm(ctx, "orders.read"));
    },
    insert: (ctx, row) => perm(ctx, "orders.write") && row.actor_id === uid(ctx),
  },
  payments: readOnlyFor("orders.read"),
  refunds: readOnlyFor("orders.read"),
  shipments: {
    read: (ctx, a) => anyOf(ownOrder(ctx, a), perm(ctx, "orders.read", "orders.write")),
    insert: (ctx) => perm(ctx, "orders.write"),
    update: (ctx) => perm(ctx, "orders.write"),
    delete: (ctx) => perm(ctx, "orders.write"),
  },
  shipment_events: {
    read: (ctx, a) =>
      anyOf(
        isUser(ctx)
          ? c(`EXISTS (SELECT 1 FROM shipments ss JOIN orders oo ON oo.id = ss.order_id WHERE ss.id = ${a}.shipment_id AND oo.user_id = ?)`, uid(ctx))
          : false,
        perm(ctx, "orders.read", "orders.write"),
      ),
    insert: (ctx) => perm(ctx, "orders.write"),
    update: (ctx) => perm(ctx, "orders.write"),
    delete: (ctx) => perm(ctx, "orders.write"),
  },
  inventory_movements: readOnlyFor("inventory.read"),

  reviews: {
    read: (ctx, a) => anyOf(c(`${a}.status = 'approved'`), own(ctx, a), perm(ctx, "reviews.moderate")),
    insert: (ctx) => perm(ctx, "reviews.moderate"),
    update: (ctx) => perm(ctx, "reviews.moderate"),
    delete: (ctx) => perm(ctx, "reviews.moderate"),
  },
  cms_sections: managedBy("content.write", (_ctx, a) => c(`${a}.state = 'published' AND ${a}.is_visible = 1`)),
  cms_pages: managedBy("content.write", (_ctx, a) => c(`${a}.state = 'published'`)),
  faqs: managedBy("content.write", (_ctx, a) => c(`${a}.is_published = 1`)),
  banners: managedBy("content.write", (_ctx, a) =>
    c(`${a}.is_active = 1 AND (${a}.starts_at IS NULL OR ${a}.starts_at <= UTC_TIMESTAMP(3)) AND (${a}.ends_at IS NULL OR ${a}.ends_at > UTC_TIMESTAMP(3))`),
  ),
  instagram_posts: managedBy("content.write", (_ctx, a) => c(`${a}.is_published = 1`)),
  media_assets: managedBy("media.write", undefined, ["products.write"]),

  subscribers: managedBy("marketing.write"),
  contact_messages: managedBy("customers.read"),

  settings: {
    read: (ctx, a) => anyOf(c(`${a}.is_public = 1`), ctx.kind === "user" && ctx.isStaff),
    insert: (ctx) => perm(ctx, "settings.write"),
    update: (ctx) => perm(ctx, "settings.write"),
    delete: (ctx) => perm(ctx, "settings.write"),
  },
  audit_logs: readOnlyFor("audit.view"),
  webhook_events: readOnlyFor("settings.write"),
  notification_log: readOnlyFor("orders.read"),
};

/** Tables visitors who are not signed in may read at all. */
export const PUBLIC_TABLES = new Set([
  "categories",
  "products",
  "product_categories",
  "product_variants",
  "product_images",
  "reviews",
  "cms_sections",
  "cms_pages",
  "faqs",
  "banners",
  "instagram_posts",
  "settings",
  "shipping_zones",
]);

/** Read access for a table alias, or true for trusted server code. */
export function readAccess(ctx: DbContext, table: string, alias: string): Access {
  if (ctx.kind === "service") return true;
  if (ctx.kind === "anon" && !PUBLIC_TABLES.has(table)) return false;
  return RULES[table]?.read?.(ctx, alias) ?? false;
}
