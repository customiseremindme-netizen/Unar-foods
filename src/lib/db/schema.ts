/**
 * The complete database structure, defined once in code.
 *
 * - The installer creates/updates the MySQL (or MariaDB) tables from this
 *   definition automatically when the site starts (see install.ts).
 * - The query engine (rest/engine.ts) uses it to convert values safely
 *   (booleans, JSON, dates) and to follow relationships between tables.
 *
 * To add a column: add it here with a default (or nullable) — it is created
 * automatically on the next start. Renaming/removing columns needs an
 * explicit step in install.ts.
 */

export type ColumnType =
  | "uuid" // CHAR(36)
  | "string" // VARCHAR(length)
  | "text" // TEXT / MEDIUMTEXT
  | "int"
  | "bigint"
  | "serial" // BIGINT AUTO_INCREMENT primary key
  | "bool"
  | "json" // objects / arrays (also used for text[] columns)
  | "datetime" // DATETIME(3), always UTC
  | "decimal" // DECIMAL(5,2)
  | "blob"; // LONGBLOB (images stored in the database)

export type Column = {
  type: ColumnType;
  length?: number;
  nullable?: boolean;
  /** SQL default (a literal such as 0, 'draft', true) */
  default?: string | number | boolean | null;
  /** Value the app fills in when an insert leaves it out (for JSON/TEXT columns, which can't have SQL defaults everywhere). */
  appDefault?: () => unknown;
  /** created_at / updated_at style columns */
  now?: "insert" | "insert_update";
  /** Generate a UUID on insert when missing */
  autoUuid?: boolean;
  medium?: boolean;
  references?: { table: string; column: string; onDelete: "cascade" | "set null" };
  /** Hidden from API reads (e.g. image bytes, password hashes) */
  hidden?: boolean;
  /** TypeScript type for generated types when more specific than Json (e.g. "string[]") */
  tsType?: string;
};

export type Table = {
  columns: Record<string, Column>;
  primaryKey: string[];
  unique?: string[][];
  indexes?: string[][];
  /**
   * Columns the app keeps in sync from other columns (used for "partial"
   * unique rules MySQL lacks). `sql` is re-evaluated on every update.
   */
  derived?: { name: string; column: Column; sql: string; compute: (row: Record<string, unknown>) => unknown }[];
  /** CHECK rules (enforced by MySQL 8.0.16+ and MariaDB 10.2+; the app validates too) */
  checks?: string[];
};

const uuid = (extra: Partial<Column> = {}): Column => ({ type: "uuid", ...extra });
const pk = (): Column => ({ type: "uuid", autoUuid: true });
const str = (length: number, extra: Partial<Column> = {}): Column => ({ type: "string", length, ...extra });
const text = (extra: Partial<Column> = {}): Column => ({ type: "text", ...extra });
const int = (extra: Partial<Column> = {}): Column => ({ type: "int", ...extra });
const bool = (def: boolean): Column => ({ type: "bool", default: def });
const json = (appDefault: () => unknown, extra: Partial<Column> = {}): Column => ({ type: "json", appDefault, ...extra });
const ts = (extra: Partial<Column> = {}): Column => ({ type: "datetime", nullable: true, ...extra });
const createdAt = (): Column => ({ type: "datetime", now: "insert" });
const updatedAt = (): Column => ({ type: "datetime", now: "insert_update" });
const ref = (table: string, onDelete: "cascade" | "set null" = "cascade", nullable = onDelete === "set null"): Column => ({
  type: "uuid",
  nullable,
  references: { table, column: "id", onDelete },
});
const userRef = (onDelete: "cascade" | "set null" = "set null") => ref("auth_users", onDelete);

export const TABLES: Record<string, Table> = {
  // ---------------------------------------------------------------------------
  // Accounts (sign-in)
  // ---------------------------------------------------------------------------
  auth_users: {
    columns: {
      id: pk(),
      email: str(254),
      password_hash: str(255, { hidden: true }),
      email_confirmed_at: ts(),
      last_sign_in_at: ts(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    unique: [["email"]],
  },
  auth_sessions: {
    columns: {
      id: str(64), // sha-256 of the session token
      user_id: ref("auth_users"),
      expires_at: { type: "datetime" },
      user_agent: str(300, { nullable: true }),
      created_at: createdAt(),
    },
    primaryKey: ["id"],
    indexes: [["user_id"], ["expires_at"]],
  },
  auth_tokens: {
    columns: {
      id: str(64), // sha-256 of the emailed token
      user_id: ref("auth_users"),
      purpose: str(20), // verify_email | reset_password
      expires_at: { type: "datetime" },
      used_at: ts(),
      created_at: createdAt(),
    },
    primaryKey: ["id"],
    indexes: [["user_id", "purpose"]],
  },

  // ---------------------------------------------------------------------------
  // People
  // ---------------------------------------------------------------------------
  profiles: {
    columns: {
      id: { type: "uuid", references: { table: "auth_users", column: "id", onDelete: "cascade" } },
      email: str(254, { nullable: true }),
      full_name: str(120, { nullable: true }),
      phone: str(10, { nullable: true }),
      marketing_consent: bool(false),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    indexes: [["email"]],
  },
  staff_members: {
    columns: {
      user_id: { type: "uuid", references: { table: "auth_users", column: "id", onDelete: "cascade" } },
      role: str(20),
      created_by: userRef(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["user_id"],
    checks: [
      "`role` IN ('owner','admin','content_editor','fulfillment')",
    ],
  },
  addresses: {
    columns: {
      id: pk(),
      user_id: ref("auth_users"),
      label: str(40, { nullable: true }),
      full_name: str(120),
      phone: str(10),
      line1: str(200),
      line2: str(200, { nullable: true }),
      landmark: str(120, { nullable: true }),
      city: str(80),
      state: str(80),
      pincode: str(6),
      country: str(2, { default: "IN" }),
      is_default: bool(false),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    indexes: [["user_id"]],
  },

  // ---------------------------------------------------------------------------
  // Catalogue
  // ---------------------------------------------------------------------------
  categories: {
    columns: {
      id: pk(),
      slug: str(120),
      name: str(80),
      description: text({ nullable: true }),
      image_url: str(500, { nullable: true }),
      sort_order: int({ default: 0 }),
      is_active: bool(true),
      seo_title: str(160, { nullable: true }),
      seo_description: str(300, { nullable: true }),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    unique: [["slug"]],
  },
  products: {
    columns: {
      id: pk(),
      slug: str(120),
      title: str(160),
      short_title: str(80, { nullable: true }),
      subtitle: str(120, { nullable: true }),
      short_description: str(400, { nullable: true }),
      description_md: text({ medium: true, appDefault: () => "" }),
      status: str(20, { default: "draft" }),
      ingredients: text({ nullable: true }),
      allergens: text({ nullable: true }),
      dietary_mark: str(40, { nullable: true }),
      nutrition: json(() => []),
      nutrition_note: str(300, { nullable: true }),
      claims: json(() => []),
      benefits: json(() => []),
      storage_instructions: text({ nullable: true }),
      shelf_life: str(200, { nullable: true }),
      shelf_life_approved: bool(false),
      shipping_returns_md: text({ nullable: true }),
      manufacturer_info: text({ nullable: true }),
      fssai_license: str(40, { nullable: true }),
      hsn_code: str(10, { nullable: true }),
      gst_rate: { type: "decimal", nullable: true },
      is_featured: bool(false),
      sort_order: int({ default: 0 }),
      seo_title: str(160, { nullable: true }),
      seo_description: str(300, { nullable: true }),
      og_image_url: str(500, { nullable: true }),
      published_at: ts(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`status` IN ('draft','published','archived')",
      "`gst_rate` IS NULL OR (`gst_rate` >= 0 AND `gst_rate` <= 40)",
    ],
    unique: [["slug"]],
    indexes: [["status", "sort_order"]],
  },
  product_categories: {
    columns: {
      product_id: ref("products"),
      category_id: ref("categories"),
    },
    primaryKey: ["product_id", "category_id"],
    indexes: [["category_id"]],
  },
  product_variants: {
    columns: {
      id: pk(),
      product_id: ref("products"),
      title: str(80, { default: "100 g" }),
      sku: str(64),
      barcode: str(64, { nullable: true }),
      weight_grams: int({ default: 0 }),
      mrp_paise: int(),
      price_paise: int(),
      stock: int({ default: 0 }),
      low_stock_threshold: int({ default: 5 }),
      is_demo_stock: bool(false),
      is_active: bool(true),
      sort_order: int({ default: 0 }),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`weight_grams` >= 0",
      "`mrp_paise` >= 0",
      "`price_paise` >= 0",
      "`price_paise` <= `mrp_paise`",
      "`stock` >= 0",
      "`low_stock_threshold` >= 0",
    ],
    unique: [["sku"]],
    indexes: [["product_id", "sort_order"]],
  },
  product_images: {
    columns: {
      id: pk(),
      product_id: ref("products"),
      url: str(500),
      storage_path: str(300, { nullable: true }),
      alt: str(240, { default: "" }),
      kind: str(20, { default: "packshot" }),
      width: int({ nullable: true }),
      height: int({ nullable: true }),
      sort_order: int({ default: 0 }),
      created_at: createdAt(),
    },
    primaryKey: ["id"],
    indexes: [["product_id", "sort_order"]],
  },

  // ---------------------------------------------------------------------------
  // Marketing & shipping
  // ---------------------------------------------------------------------------
  coupons: {
    columns: {
      id: pk(),
      code: str(32),
      description: str(200, { nullable: true }),
      discount_type: str(20),
      discount_value: int({ default: 0 }),
      min_subtotal_paise: int({ default: 0 }),
      max_discount_paise: int({ nullable: true }),
      usage_limit: int({ nullable: true }),
      per_customer_limit: int({ nullable: true }),
      starts_at: ts(),
      ends_at: ts(),
      is_active: bool(true),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`discount_type` IN ('percent','fixed','free_shipping')",
      "`discount_value` >= 0",
      "`min_subtotal_paise` >= 0",
      "`discount_type` <> 'percent' OR `discount_value` BETWEEN 1 AND 100",
      "`max_discount_paise` IS NULL OR `max_discount_paise` > 0",
      "`usage_limit` IS NULL OR `usage_limit` > 0",
      "`per_customer_limit` IS NULL OR `per_customer_limit` > 0",
    ],
    unique: [["code"]],
  },
  shipping_zones: {
    columns: {
      id: pk(),
      name: str(80),
      is_active: bool(true),
      sort_order: int({ default: 0 }),
      match_type: str(20, { default: "all" }),
      states: json(() => [], { tsType: "string[]" }),
      pincode_prefixes: json(() => [], { tsType: "string[]" }),
      rate_type: str(10, { default: "flat" }),
      flat_rate_paise: int({ default: 0 }),
      base_weight_grams: int({ default: 500 }),
      base_rate_paise: int({ default: 0 }),
      additional_weight_step_grams: int({ default: 500 }),
      additional_rate_paise: int({ default: 0 }),
      free_shipping_threshold_paise: int({ nullable: true }),
      cod_available: bool(false),
      delivery_estimate: str(80, { nullable: true }),
      notes: str(300, { nullable: true }),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`match_type` IN ('all','states','pincode_prefixes')",
      "`rate_type` IN ('flat','weight')",
      "`flat_rate_paise` >= 0",
      "`base_weight_grams` > 0",
      "`base_rate_paise` >= 0",
      "`additional_weight_step_grams` > 0",
      "`additional_rate_paise` >= 0",
    ],
  },

  // ---------------------------------------------------------------------------
  // Carts
  // ---------------------------------------------------------------------------
  carts: {
    columns: {
      id: pk(),
      user_id: ref("auth_users", "cascade", true),
      email: str(254, { nullable: true }),
      recovery_consent: bool(false),
      status: str(20, { default: "active" }),
      coupon_code: str(32, { nullable: true }),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    indexes: [["status", "updated_at"]],
    unique: [["active_user_key"]],
    // one active cart per signed-in customer
    derived: [
      {
        name: "active_user_key",
        column: { type: "uuid", nullable: true, hidden: true },
        sql: "IF(`status` = 'active', `user_id`, NULL)",
        compute: (row) => (row.status === "active" && row.user_id ? row.user_id : null),
      },
    ],
    checks: ["`status` IN ('active','converted','merged')"],
  },
  cart_items: {
    columns: {
      cart_id: ref("carts"),
      variant_id: ref("product_variants"),
      quantity: int(),
      added_at: createdAt(),
    },
    primaryKey: ["cart_id", "variant_id"],
    checks: [
      "`quantity` BETWEEN 1 AND 99",
    ],
  },

  // ---------------------------------------------------------------------------
  // Orders & payments
  // ---------------------------------------------------------------------------
  counters: {
    columns: { name: str(40), value: { type: "bigint", default: 0 } },
    primaryKey: ["name"],
  },
  orders: {
    columns: {
      id: pk(),
      order_number: str(20),
      user_id: userRef(),
      cart_id: ref("carts", "set null"),
      email: str(254),
      phone: str(10),
      customer_name: str(120),
      shipping_address: json(() => ({})),
      billing_address: json(() => null, { nullable: true }),
      status: str(20, { default: "pending_payment" }),
      payment_status: str(20, { default: "unpaid" }),
      fulfillment_status: str(20, { default: "unfulfilled" }),
      payment_method: str(20),
      currency: str(3, { default: "INR" }),
      subtotal_paise: int(),
      discount_paise: int({ default: 0 }),
      shipping_paise: int({ default: 0 }),
      cod_fee_paise: int({ default: 0 }),
      tax_paise: int({ default: 0 }),
      prices_include_tax: bool(true),
      tax_breakdown: json(() => ({})),
      total_paise: int(),
      refunded_paise: int({ default: 0 }),
      coupon_id: ref("coupons", "set null"),
      coupon_code: str(32, { nullable: true }),
      shipping_zone_id: ref("shipping_zones", "set null"),
      shipping_method: str(120, { nullable: true }),
      total_weight_grams: int({ default: 0 }),
      customer_note: str(500, { nullable: true }),
      needs_attention: bool(false),
      attention_reason: str(500, { nullable: true }),
      access_token_hash: str(128),
      reservation_expires_at: ts(),
      marketing_consent: bool(false),
      terms_accepted_at: ts(),
      placed_at: ts(),
      paid_at: ts(),
      cancelled_at: ts(),
      cancel_reason: str(300, { nullable: true }),
      shipped_at: ts(),
      delivered_at: ts(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`status` IN ('pending_payment','placed','cancelled','expired','payment_failed')",
      "`payment_status` IN ('unpaid','paid','failed','refunded','partially_refunded','cod_pending','cod_collected')",
      "`fulfillment_status` IN ('unfulfilled','processing','packed','shipped','delivered','returned','cancelled')",
      "`payment_method` IN ('razorpay','cod')",
      "`subtotal_paise` >= 0",
      "`discount_paise` >= 0",
      "`shipping_paise` >= 0",
      "`cod_fee_paise` >= 0",
      "`tax_paise` >= 0",
      "`total_paise` >= 0",
      "`refunded_paise` >= 0",
    ],
    unique: [["order_number"]],
    indexes: [["user_id", "created_at"], ["email"], ["status", "created_at"], ["payment_status", "paid_at"], ["status", "reservation_expires_at"]],
  },
  order_items: {
    columns: {
      id: pk(),
      order_id: ref("orders"),
      product_id: ref("products", "set null"),
      variant_id: ref("product_variants", "set null"),
      title: str(160),
      variant_title: str(80, { nullable: true }),
      sku: str(64, { nullable: true }),
      image_url: str(500, { nullable: true }),
      unit_price_paise: int(),
      mrp_paise: int(),
      quantity: int(),
      line_total_paise: int(),
      weight_grams: int({ default: 0 }),
      hsn_code: str(10, { nullable: true }),
      gst_rate: { type: "decimal", nullable: true },
      created_at: createdAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`unit_price_paise` >= 0",
      "`mrp_paise` >= 0",
      "`quantity` > 0",
      "`line_total_paise` >= 0",
    ],
    indexes: [["order_id"], ["product_id"]],
  },
  order_events: {
    columns: {
      id: { type: "serial" },
      order_id: ref("orders"),
      type: str(40),
      message: str(1000),
      visibility: str(10, { default: "internal" }),
      actor_id: userRef(),
      created_at: createdAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`visibility` IN ('customer','internal')",
    ],
    indexes: [["order_id", "created_at"]],
  },
  payments: {
    columns: {
      id: pk(),
      order_id: ref("orders"),
      provider: str(20),
      provider_order_id: str(100, { nullable: true }),
      provider_payment_id: str(100, { nullable: true }),
      amount_paise: int(),
      status: str(20, { default: "created" }),
      method: str(40, { nullable: true }),
      error_code: str(100, { nullable: true }),
      error_description: str(500, { nullable: true }),
      raw: json(() => null, { nullable: true }),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`amount_paise` >= 0",
    ],
    unique: [["provider_payment_id"]],
    indexes: [["order_id"], ["provider_order_id"]],
  },
  refunds: {
    columns: {
      id: pk(),
      order_id: ref("orders"),
      payment_id: ref("payments", "set null"),
      provider: str(20, { default: "razorpay" }),
      provider_refund_id: str(100, { nullable: true }),
      amount_paise: int(),
      status: str(20, { default: "pending" }),
      reason: str(300, { nullable: true }),
      restocked: bool(false),
      created_by: userRef(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`amount_paise` > 0",
      "`status` IN ('pending','processed','failed')",
    ],
    unique: [["provider_refund_id"]],
    indexes: [["order_id"]],
  },
  shipments: {
    columns: {
      id: pk(),
      order_id: ref("orders"),
      provider: str(20, { default: "manual" }),
      carrier: str(80, { nullable: true }),
      tracking_number: str(80, { nullable: true }),
      tracking_url: str(500, { nullable: true }),
      status: str(30, { default: "pending" }),
      provider_order_id: str(100, { nullable: true }),
      provider_shipment_id: str(100, { nullable: true }),
      awb_code: str(80, { nullable: true }),
      label_url: str(500, { nullable: true }),
      shipped_at: ts(),
      delivered_at: ts(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    indexes: [["order_id"]],
  },
  shipment_events: {
    columns: {
      id: { type: "serial" },
      shipment_id: ref("shipments"),
      status: str(40),
      description: str(500, { nullable: true }),
      location: str(200, { nullable: true }),
      source: str(20, { default: "admin" }),
      occurred_at: createdAt(),
      created_at: createdAt(),
    },
    primaryKey: ["id"],
    indexes: [["shipment_id", "occurred_at"]],
  },
  coupon_usages: {
    columns: {
      id: pk(),
      coupon_id: ref("coupons"),
      order_id: ref("orders"),
      user_id: userRef(),
      email: str(254),
      discount_paise: int({ default: 0 }),
      status: str(20, { default: "reserved" }),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`status` IN ('reserved','used','released')",
    ],
    unique: [["order_id"]],
    indexes: [["coupon_id", "status"]],
  },
  inventory_movements: {
    columns: {
      id: { type: "serial" },
      variant_id: ref("product_variants"),
      delta: int(),
      stock_after: int(),
      reason: str(30),
      order_id: ref("orders", "set null"),
      note: str(300, { nullable: true }),
      actor_id: userRef(),
      created_at: createdAt(),
    },
    primaryKey: ["id"],
    indexes: [["variant_id", "created_at"], ["created_at"]],
  },

  // ---------------------------------------------------------------------------
  // Reviews & content
  // ---------------------------------------------------------------------------
  reviews: {
    columns: {
      id: pk(),
      product_id: ref("products"),
      user_id: userRef(),
      author_name: str(60),
      rating: int(),
      title: str(120, { nullable: true }),
      body: str(2000),
      status: str(20, { default: "pending" }),
      is_verified_purchase: bool(false),
      admin_reply: str(1000, { nullable: true }),
      approved_at: ts(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`rating` BETWEEN 1 AND 5",
      "`status` IN ('pending','approved','rejected','spam')",
    ],
    unique: [["product_id", "user_id"]],
    indexes: [["product_id", "status", "created_at"]],
  },
  review_media: {
    columns: {
      id: pk(),
      review_id: ref("reviews", "set null"),
      owner_id: { ...ref("auth_users"), hidden: true },
      mime_type: str(60),
      size_bytes: int(),
      width: int({ nullable: true }),
      height: int({ nullable: true }),
      data: { type: "blob", hidden: true },
      created_at: createdAt(),
    },
    primaryKey: ["id"],
    indexes: [["review_id"], ["owner_id", "created_at"]],
    checks: ["`mime_type` IN ('image/webp','video/mp4')", "`size_bytes` > 0 AND `size_bytes` <= 8388608"],
  },
  cms_sections: {
    columns: {
      id: pk(),
      page: str(40, { default: "home" }),
      key: str(60),
      type: str(40),
      state: str(10),
      sort_order: int({ default: 0 }),
      is_visible: bool(true),
      content: json(() => ({}), { medium: true }),
      updated_by: userRef(),
      published_at: ts(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`state` IN ('draft','published')",
    ],
    unique: [["page", "key", "state"]],
  },
  cms_pages: {
    columns: {
      id: pk(),
      group_id: uuid({ autoUuid: true }),
      kind: str(10),
      state: str(10),
      slug: str(120),
      title: str(160),
      excerpt: str(400, { nullable: true }),
      body_md: text({ medium: true, appDefault: () => "" }),
      cover_image_url: str(500, { nullable: true }),
      cover_image_alt: str(200, { nullable: true }),
      author_name: str(80, { nullable: true }),
      seo_title: str(160, { nullable: true }),
      seo_description: str(300, { nullable: true }),
      requires_owner_review: bool(false),
      published_at: ts(),
      updated_by: userRef(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    checks: [
      "`kind` IN ('page','policy','post')",
      "`state` IN ('draft','published')",
    ],
    unique: [["group_id", "state"], ["kind", "slug", "state"]],
  },
  faqs: {
    columns: {
      id: pk(),
      question: str(300),
      answer_md: text(),
      category: str(60, { default: "General" }),
      sort_order: int({ default: 0 }),
      is_published: bool(true),
      show_on_home: bool(true),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
  },
  banners: {
    columns: {
      id: pk(),
      placement: str(20),
      title: str(160),
      body: str(400, { nullable: true }),
      cta_label: str(40, { nullable: true }),
      cta_url: str(500, { nullable: true }),
      image_url: str(500, { nullable: true }),
      image_alt: str(200, { nullable: true }),
      starts_at: ts(),
      ends_at: ts(),
      is_active: bool(false),
      sort_order: int({ default: 0 }),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
  },
  instagram_posts: {
    columns: {
      id: pk(),
      image_url: str(500),
      image_alt: str(200, { default: "" }),
      permalink: str(500),
      caption: str(300, { nullable: true }),
      is_published: bool(false),
      sort_order: int({ default: 0 }),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
  },
  media_assets: {
    columns: {
      id: pk(),
      url: str(500),
      storage_path: str(300),
      mime_type: str(60),
      size_bytes: int(),
      width: int({ nullable: true }),
      height: int({ nullable: true }),
      alt: str(200, { default: "" }),
      data: { type: "blob", nullable: true, hidden: true },
      uploaded_by: userRef(),
      created_at: createdAt(),
    },
    primaryKey: ["id"],
    unique: [["storage_path"]],
  },

  // ---------------------------------------------------------------------------
  // Customers contacting the business
  // ---------------------------------------------------------------------------
  subscribers: {
    columns: {
      id: pk(),
      email: str(254),
      status: str(20, { default: "subscribed" }),
      consent_text: str(300),
      consent_at: createdAt(),
      source: str(40, { nullable: true }),
      unsubscribe_token: str(64),
      unsubscribed_at: ts(),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
    unique: [["email"], ["unsubscribe_token"]],
  },
  contact_messages: {
    columns: {
      id: pk(),
      name: str(120),
      email: str(254),
      phone: str(20, { nullable: true }),
      subject: str(160, { nullable: true }),
      message: text(),
      status: str(20, { default: "new" }),
      created_at: createdAt(),
      updated_at: updatedAt(),
    },
    primaryKey: ["id"],
  },

  // ---------------------------------------------------------------------------
  // Settings, audit, integrations
  // ---------------------------------------------------------------------------
  settings: {
    columns: {
      key: str(40),
      value: json(() => ({}), { medium: true }),
      is_public: bool(false),
      updated_by: userRef(),
      updated_at: updatedAt(),
    },
    primaryKey: ["key"],
  },
  audit_logs: {
    columns: {
      id: { type: "serial" },
      actor_id: userRef(),
      actor_email: str(254, { nullable: true }),
      action: str(80),
      entity_type: str(40),
      entity_id: str(100, { nullable: true }),
      summary: str(500, { nullable: true }),
      diff: json(() => null, { nullable: true }),
      created_at: createdAt(),
    },
    primaryKey: ["id"],
    indexes: [["created_at"], ["entity_type", "entity_id"]],
  },
  webhook_events: {
    columns: {
      id: pk(),
      provider: str(20),
      event_id: str(100),
      event_type: str(60, { nullable: true }),
      payload: json(() => null, { nullable: true, medium: true }),
      status: str(20, { default: "received" }),
      error: str(500, { nullable: true }),
      received_at: createdAt(),
      processed_at: ts(),
    },
    primaryKey: ["id"],
    unique: [["provider", "event_id"]],
  },
  notification_log: {
    columns: {
      id: { type: "serial" },
      order_id: ref("orders", "cascade", true),
      template: str(40),
      recipient: str(254),
      channel: str(20, { default: "email" }),
      status: str(20),
      provider_message_id: str(200, { nullable: true }),
      error: str(500, { nullable: true }),
      created_at: createdAt(),
    },
    primaryKey: ["id"],
    indexes: [["order_id"]],
  },
  rate_limits: {
    columns: {
      key: str(200),
      window_start: { type: "datetime" },
      count: int({ default: 0 }),
    },
    primaryKey: ["key", "window_start"],
  },
  schema_meta: {
    columns: { key: str(60), value: str(200), updated_at: updatedAt() },
    primaryKey: ["key"],
  },
};

export type TableName = keyof typeof TABLES;

export function getTable(name: string): Table {
  const table = TABLES[name];
  if (!table) throw new Error(`Unknown table "${name}"`);
  return table;
}
