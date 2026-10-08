/**
 * Database security tests (row level security + function permissions).
 * They run against the LOCAL Supabase started with `npx supabase start`
 * and are skipped automatically when it isn't configured:
 *
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321 \
 *   SUPABASE_TEST_ANON_KEY=... SUPABASE_TEST_SERVICE_KEY=... npm run test:db
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
const enabled = !!(url && anonKey && serviceKey);

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!enabled)("database security", () => {
  let anon: SupabaseClient;
  let admin: SupabaseClient;
  let customer: SupabaseClient;
  let customerId = "";
  const email = `rls+${Date.now()}@example.com`;
  const password = "Rls-test-Passw0rd";

  beforeAll(async () => {
    anon = createClient(url!, anonKey!, opts);
    admin = createClient(url!, serviceKey!, opts);
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    customerId = data.user.id;
    customer = createClient(url!, anonKey!, opts);
    const { error: signInError } = await customer.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  });

  afterAll(async () => {
    if (customerId) await admin.auth.admin.deleteUser(customerId);
  });

  it("visitors only see published products", async () => {
    const { data } = await anon.from("products").select("status");
    expect((data ?? []).every((p) => p.status === "published")).toBe(true);
  });

  it("visitors cannot read private settings, orders, customers or carts", async () => {
    for (const table of ["orders", "profiles", "addresses", "carts", "payments", "audit_logs", "webhook_events", "staff_members", "subscribers", "contact_messages"]) {
      const { data } = await anon.from(table).select("*").limit(1);
      expect(data ?? [], table).toEqual([]);
    }
    const { data: settings } = await anon.from("settings").select("key");
    const keys = (settings ?? []).map((s) => s.key);
    expect(keys).not.toContain("notifications");
    expect(keys).not.toContain("shiprocket");
  });

  it("only the server can create orders (prices can't be set by a browser)", async () => {
    for (const client of [anon, customer]) {
      const { error } = await client.rpc("create_order", { p_order: {}, p_items: [] });
      expect(error).not.toBeNull();
    }
  });

  it("customers cannot change products, prices or stock", async () => {
    const { data: product } = await anon.from("product_variants").select("id, price_paise").limit(1).single();
    await customer.from("product_variants").update({ price_paise: 1 }).eq("id", product!.id);
    const { data: after } = await anon.from("product_variants").select("price_paise").eq("id", product!.id).single();
    expect(after!.price_paise).toBe(product!.price_paise);
    const { error } = await customer.rpc("adjust_stock", { p_variant_id: product!.id, p_delta: 100, p_reason: "restock", p_note: "" });
    expect(error).not.toBeNull();
  });

  it("customers cannot make themselves staff", async () => {
    const { error } = await customer.from("staff_members").insert({ user_id: customerId, role: "owner" });
    expect(error).not.toBeNull();
    const { error: bootstrapError } = await customer.rpc("bootstrap_owner", { p_email: email });
    expect(bootstrapError).not.toBeNull();
    const { data: perm } = await customer.rpc("has_permission", { perm: "orders.read" });
    expect(perm).toBe(false);
  });

  it("customers only see their own orders", async () => {
    const { data } = await customer.from("orders").select("id, user_id");
    expect((data ?? []).every((o) => o.user_id === customerId)).toBe(true);
  });

  it("reviews can't be published by writing to the table directly", async () => {
    const { data: product } = await anon.from("products").select("id").limit(1).single();
    const { error } = await customer.from("reviews").insert({ product_id: product!.id, author_name: "Fake", rating: 5, body: "Fake five star review", status: "approved" });
    expect(error).not.toBeNull();
  });

  it("the last owner can never be removed", async () => {
    const { data: owners } = await admin.from("staff_members").select("user_id").eq("role", "owner");
    if ((owners ?? []).length === 1) {
      const { error } = await admin.from("staff_members").delete().eq("user_id", owners![0].user_id);
      expect(error?.message).toContain("LAST_OWNER");
    }
  });
});
