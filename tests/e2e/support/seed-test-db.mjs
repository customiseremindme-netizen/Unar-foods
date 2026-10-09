/**
 * LOCAL TEST DATABASE ONLY — prepares a local copy of the shop for the
 * browser tests: publishes the two products with clearly-marked DEMO stock,
 * turns on demo shipping rates and Cash on Delivery, and creates the test
 * owner account (owner@unar.local / OwnerPass123).
 *
 *   node tests/e2e/support/seed-test-db.mjs
 *
 * It refuses to run against anything but a local/private database server,
 * so it can never touch the live shop.
 */
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mysql = require("mysql2/promise");

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const host = process.env.DB_HOST ?? "";
const isPrivate = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
if (!isPrivate && process.env.E2E_ALLOW_SEED !== "1") {
  console.error(`Refusing to seed ${host || "(no DB_HOST)"}: test data is only for a local database.`);
  process.exit(1);
}

const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
// The site creates its tables on first use; wait for it.
for (let i = 0; ; i++) {
  try {
    const res = await fetch(`${base}/api/health`);
    if (res.ok) break;
  } catch {
    // not up yet
  }
  if (i > 90) throw new Error(`The site at ${base} is not ready (open ${base}/api/health).`);
  await new Promise((r) => setTimeout(r, 2000));
}

const db = await mysql.createConnection({
  host,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: "Z",
});
await db.query("SET time_zone = '+00:00'");

const [products] = await db.query("SELECT id, claims FROM products");
for (const p of products) {
  const claims = (typeof p.claims === "string" ? JSON.parse(p.claims) : p.claims) ?? [];
  await db.query("UPDATE products SET status = 'published', published_at = COALESCE(published_at, UTC_TIMESTAMP(3)), shelf_life_approved = 1, claims = ? WHERE id = ?", [
    JSON.stringify(claims.map((c) => ({ ...c, approved: true }))),
    p.id,
  ]);
}
const [variants] = await db.query("SELECT id FROM product_variants");
for (const v of variants) {
  await db.query("UPDATE product_variants SET stock = 25, is_demo_stock = 1 WHERE id = ?", [v.id]);
  await db.query("INSERT INTO inventory_movements (variant_id, delta, stock_after, reason, note) VALUES (?, 25, 25, 'initial', 'LOCAL DEMO STOCK — not real inventory')", [v.id]);
}
await db.query(
  "UPDATE shipping_zones SET is_active = 1, flat_rate_paise = 6000, free_shipping_threshold_paise = 49900, cod_available = 1, notes = 'LOCAL DEMO RATES — not real business rates'",
);
await db.query("UPDATE cms_sections SET is_visible = 1 WHERE `key` = 'trust'");
await db.query("UPDATE settings SET value = JSON_SET(value, '$.cod_enabled', true) WHERE `key` = 'checkout'");

const email = process.env.E2E_ADMIN_EMAIL ?? "owner@unar.local";
const password = process.env.E2E_ADMIN_PASSWORD ?? "OwnerPass123";
const [existing] = await db.query("SELECT id FROM auth_users WHERE email = ?", [email]);
let userId = existing[0]?.id;
if (!userId) {
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const hash = `scrypt$16384$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
  userId = randomUUID();
  await db.query("INSERT INTO auth_users (id, email, password_hash, email_confirmed_at) VALUES (?, ?, ?, UTC_TIMESTAMP(3))", [userId, email, hash]);
  await db.query("INSERT INTO profiles (id, email, full_name) VALUES (?, ?, 'Test Owner')", [userId, email]);
}
await db.query("INSERT IGNORE INTO staff_members (user_id, role) VALUES (?, 'owner')", [userId]);
await db.end();
console.log("Local test data ready (demo stock, demo shipping, owner account).");
