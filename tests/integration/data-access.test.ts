/**
 * Access rules and commerce safety on a real MySQL / MariaDB server.
 * Skipped unless TEST_DATABASE_URL points at a TEST database (its tables are
 * dropped and recreated):
 *
 *   TEST_DATABASE_URL=mysql://unar:unarpw@127.0.0.1:3306/unar_test npm run test:db
 */
import { randomUUID } from "node:crypto";
import mysql, { type Pool } from "mysql2/promise";
import { PostgrestClient } from "@supabase/postgrest-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/database.types";
import { installSchema } from "@/lib/db/install";
import { ANON, SERVICE, type DbContext } from "@/lib/db/rest/context";
import { handleDataRequest } from "@/lib/db/rest/handler";
import { RPCS } from "@/lib/db/rpc";
import { permissionsForRole, type StaffRole } from "@/lib/auth/permissions";

const url = process.env.TEST_DATABASE_URL;

function clientFor(pool: Pool, ctx: DbContext) {
  return new PostgrestClient<Database>("http://unar.db/rest", {
    fetch: (input, init) => handleDataRequest(pool, ctx, RPCS, input as string, init),
    retry: false,
  });
}

const user = (id: string, role: StaffRole | null = null): DbContext => ({
  kind: "user",
  userId: id,
  email: `${id}@example.com`,
  perms: role ? permissionsForRole(role) : new Set(),
  isStaff: role !== null,
});

describe.skipIf(!url)("data access rules", () => {
  let pool: Pool;
  const customerId = randomUUID();
  const otherId = randomUUID();
  const ownerId = randomUUID();
  const editorId = randomUUID();
  let variantId = "";
  let otherOrderId = "";

  beforeAll(async () => {
    pool = mysql.createPool({ uri: url!, connectionLimit: 8, dateStrings: true, timezone: "Z" });
    const [tables] = await pool.query<mysql.RowDataPacket[]>("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const row of tables) await pool.query(`DROP TABLE \`${row.t}\``);
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
    await installSchema(pool);

    for (const [id, email] of [
      [customerId, "customer@example.com"],
      [otherId, "other@example.com"],
      [ownerId, "owner@example.com"],
      [editorId, "editor@example.com"],
    ]) {
      await pool.query("INSERT INTO auth_users (id, email, password_hash, email_confirmed_at) VALUES (?, ?, 'x', UTC_TIMESTAMP(3))", [id, email]);
      await pool.query("INSERT INTO profiles (id, email) VALUES (?, ?)", [id, email]);
    }
    await pool.query("INSERT INTO staff_members (user_id, role) VALUES (?, 'owner'), (?, 'content_editor')", [ownerId, editorId]);

    // One product published with 1 pack left, explicitly keep the other as a draft.
    await pool.query("UPDATE products SET status = 'draft' WHERE slug = 'banana-chewy-fresh-raw-banana'");
    await pool.query("UPDATE products SET status = 'published' WHERE slug = 'banana-chewy-dry-fruits-seeds'");
    const [v] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT pv.id FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE p.slug = 'banana-chewy-dry-fruits-seeds'",
    );
    variantId = v[0].id;
    await pool.query("UPDATE product_variants SET stock = 1 WHERE id = ?", [variantId]);

    const service = clientFor(pool, SERVICE);
    const created = await service.rpc("create_order", {
      p_order: {
        user_id: otherId,
        email: "other@example.com",
        phone: "9876543210",
        customer_name: "Other Customer",
        shipping_address: { line1: "Somewhere" },
        payment_method: "cod",
        subtotal_paise: 0,
        total_paise: 0,
        access_token_hash: "x".repeat(64),
        terms_accepted: true,
      },
      p_items: [],
    });
    expect(created.error?.message).toBe("EMPTY_CART");
    otherOrderId = randomUUID();
    await pool.query(
      `INSERT INTO orders (id, order_number, user_id, email, phone, customer_name, shipping_address, payment_method, subtotal_paise, total_paise, access_token_hash, tax_breakdown)
       VALUES (?, 'UNAR-TEST01', ?, 'other@example.com', '9876543210', 'Other Customer', '{}', 'cod', 100, 100, 'x', '{}')`,
      [otherOrderId, otherId],
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("visitors only see published products", async () => {
    const { data } = await clientFor(pool, ANON).from("products").select("status");
    expect(data?.length).toBe(1);
    expect(data!.every((p) => p.status === "published")).toBe(true);
  });

  it("review attachments stay private until approval and cannot be claimed by another customer", async () => {
    const reviewId = randomUUID(), mediaId = randomUUID();
    const [products] = await pool.query<mysql.RowDataPacket[]>("SELECT id FROM products WHERE status = 'published' LIMIT 1");
    await pool.query("INSERT INTO reviews (id, product_id, user_id, author_name, rating, body, status) VALUES (?, ?, ?, 'Test customer', 4, 'A genuine test review for the isolated test store', 'pending')", [reviewId, products[0].id, customerId]);
    await pool.query("INSERT INTO review_media (id, review_id, owner_id, mime_type, size_bytes, data) VALUES (?, ?, ?, 'image/webp', 1, ?)", [mediaId, reviewId, customerId, Buffer.from([0])]);
    const query = (ctx: DbContext) => clientFor(pool, ctx).from("review_media").select("id").eq("id", mediaId);
    expect((await query(ANON)).data).toEqual([]);
    expect((await query(user(otherId))).data).toEqual([]);
    expect((await query(user(customerId))).data?.length).toBe(1);
    expect((await query(user(ownerId, "owner"))).data?.length).toBe(1);
    const patch = await clientFor(pool, user(otherId)).from("review_media").update({ review_id: randomUUID() }).eq("id", mediaId);
    expect(patch.error).toBeTruthy();
    await pool.query("UPDATE reviews SET status = 'approved' WHERE id = ?", [reviewId]);
    expect((await query(ANON)).data?.length).toBe(1);
    await pool.query("UPDATE reviews SET status = 'rejected' WHERE id = ?", [reviewId]);
    expect((await query(ANON)).data).toEqual([]);
    await pool.query("DELETE FROM review_media WHERE id = ?", [mediaId]);
    await pool.query("DELETE FROM reviews WHERE id = ?", [reviewId]);
  });

  it("visitors cannot read private data", async () => {
    const anon = clientFor(pool, ANON);
    for (const table of ["orders", "profiles", "addresses", "carts", "payments", "audit_logs", "webhook_events", "staff_members", "subscribers", "contact_messages", "auth_users"] as const) {
      const { data } = await anon.from(table as "orders").select("*").limit(1);
      expect(data ?? [], table).toEqual([]);
    }
    const { data: settings } = await anon.from("settings").select("key");
    const keys = (settings ?? []).map((s) => s.key);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).not.toContain("notifications");
  });

  it("password hashes are never returned", async () => {
    const { data, error } = await clientFor(pool, SERVICE).from("auth_users" as "profiles").select("*").limit(1);
    expect(error).toBeNull();
    expect(Object.keys(data![0])).not.toContain("password_hash");
    const { error: explicit } = await clientFor(pool, SERVICE).from("auth_users" as "profiles").select("password_hash" as "id");
    expect(explicit).not.toBeNull();
  });

  it("only the server can create orders or change payment state", async () => {
    for (const ctx of [ANON, user(customerId), user(ownerId, "owner")]) {
      const db = clientFor(pool, ctx);
      expect((await db.rpc("create_order", { p_order: {}, p_items: [] })).error?.code).toBe("42501");
      expect((await db.rpc("mark_order_paid", { p_order_id: otherOrderId } as never)).error?.code).toBe("42501");
    }
  });

  it("customers cannot change products, prices, stock or reviews", async () => {
    const customer = clientFor(pool, user(customerId));
    const { error } = await customer.from("product_variants").update({ price_paise: 1 }).eq("id", variantId);
    expect(error?.code).toBe("42501");
    const [after] = await pool.query<mysql.RowDataPacket[]>("SELECT price_paise FROM product_variants WHERE id = ?", [variantId]);
    expect(after[0].price_paise).not.toBe(1);
    expect((await customer.rpc("adjust_stock", { p_variant_id: variantId, p_delta: 100, p_reason: "restock", p_note: "" })).error?.code).toBe("42501");
    const { data: product } = await customer.from("products").select("id").limit(1).single();
    const fake = await customer.from("reviews").insert({ product_id: product!.id, author_name: "Fake", rating: 5, body: "Fake five star review", status: "approved" });
    expect(fake.error?.code).toBe("42501");
  });

  it("customers cannot make themselves staff", async () => {
    const { error } = await clientFor(pool, user(customerId)).from("staff_members").insert({ user_id: customerId, role: "owner" });
    expect(error?.code).toBe("42501");
  });

  it("customers only see and change their own data", async () => {
    const customer = clientFor(pool, user(customerId));
    expect((await customer.from("orders").select("id")).data).toEqual([]);
    const other = clientFor(pool, user(otherId));
    expect((await other.from("orders").select("id")).data?.map((o) => o.id)).toEqual([otherOrderId]);

    const { data: profiles } = await customer.from("profiles").select("id");
    expect(profiles?.map((p) => p.id)).toEqual([customerId]);
    await customer.from("profiles").update({ full_name: "Hacked" }).eq("id", otherId);
    const [p] = await pool.query<mysql.RowDataPacket[]>("SELECT full_name FROM profiles WHERE id = ?", [otherId]);
    expect(p[0].full_name).toBeNull();

    const bad = await customer.from("addresses").insert({
      user_id: otherId,
      full_name: "X Y",
      phone: "9876543210",
      line1: "Road",
      city: "City",
      state: "State",
      pincode: "641664",
    });
    expect(bad.error?.code).toBe("42501");
  });

  it("staff only get what their role allows", async () => {
    const editor = clientFor(pool, user(editorId, "content_editor"));
    expect((await editor.from("orders").select("id")).data).toEqual([]);
    expect((await editor.from("products").select("id")).data?.length).toBe(2); // drafts too
    const owner = clientFor(pool, user(ownerId, "owner"));
    expect((await owner.from("orders").select("id")).data?.length).toBe(1);
    expect((await editor.rpc("record_refund", { p_order_id: otherOrderId } as never)).error?.code).toBe("42501");
  });

  it("the last owner can never be removed or demoted", async () => {
    const owner = clientFor(pool, user(ownerId, "owner"));
    expect((await owner.from("staff_members").delete().eq("user_id", ownerId)).error?.message).toContain("LAST_OWNER");
    expect((await owner.from("staff_members").update({ role: "admin" }).eq("user_id", ownerId)).error?.message).toContain("LAST_OWNER");
    expect((await owner.from("staff_members").update({ role: "admin" }).eq("user_id", editorId)).error).toBeNull();
  });

  it("two shoppers can't both buy the last pack", async () => {
    const service = clientFor(pool, SERVICE);
    const [price] = await pool.query<mysql.RowDataPacket[]>("SELECT price_paise FROM product_variants WHERE id = ?", [variantId]);
    const unit = Number(price[0].price_paise);
    const attempt = (n: number) =>
      service.rpc("create_order", {
        p_order: {
          email: `buyer${n}@example.com`,
          phone: "9876543210",
          customer_name: `Buyer ${n}`,
          shipping_address: { line1: "Road" },
          payment_method: "razorpay",
          subtotal_paise: unit,
          total_paise: unit,
          access_token_hash: "y".repeat(64),
          terms_accepted: true,
        },
        p_items: [{ variant_id: variantId, quantity: 1, unit_price_paise: unit }],
      });
    const results = await Promise.all([attempt(1), attempt(2), attempt(3)]);
    expect(results.filter((r) => !r.error).length).toBe(1);
    expect(results.filter((r) => r.error?.message.startsWith("INSUFFICIENT_STOCK")).length).toBe(2);
    const [stock] = await pool.query<mysql.RowDataPacket[]>("SELECT stock FROM product_variants WHERE id = ?", [variantId]);
    expect(stock[0].stock).toBe(0);

    // Paying twice (browser + webhook) only counts once; releasing returns the stock.
    const orderId = (results.find((r) => !r.error)!.data as { order_id: string }).order_id;
    const pay = () =>
      service.rpc("mark_order_paid", {
        p_order_id: orderId,
        p_provider_order_id: "order_x",
        p_provider_payment_id: "pay_x",
        p_amount_paise: unit,
        p_method: "upi",
        p_payment_status: "captured",
        p_raw: {},
      });
    const [a, b] = await Promise.all([pay(), pay()]);
    expect([a.data, b.data].sort()).toEqual(["already_paid", "paid"]);
    const [payments] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS n FROM payments WHERE order_id = ?", [orderId]);
    expect(Number(payments[0].n)).toBe(1);
    expect((await service.rpc("release_order", { p_order_id: orderId, p_new_status: "expired", p_reason: "test" })).data).toBe(false);
  });

  it("order numbers keep counting up", async () => {
    await pool.query("UPDATE product_variants SET stock = 5 WHERE id = ?", [variantId]);
    const [price] = await pool.query<mysql.RowDataPacket[]>("SELECT price_paise FROM product_variants WHERE id = ?", [variantId]);
    const unit = Number(price[0].price_paise);
    const numbers: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { data, error } = await clientFor(pool, SERVICE).rpc("create_order", {
        p_order: {
          email: "seq@example.com",
          phone: "9876543210",
          customer_name: "Seq Buyer",
          shipping_address: { line1: "Road" },
          payment_method: "cod",
          subtotal_paise: unit,
          total_paise: unit,
          access_token_hash: "z".repeat(64),
          terms_accepted: true,
        },
        p_items: [{ variant_id: variantId, quantity: 1, unit_price_paise: unit }],
      });
      expect(error).toBeNull();
      numbers.push((data as { order_number: string }).order_number);
    }
    expect(numbers[0]).toMatch(/^UNAR-\d{6}$/);
    expect(Number(numbers[1].slice(5))).toBe(Number(numbers[0].slice(5)) + 1);
  });
});
