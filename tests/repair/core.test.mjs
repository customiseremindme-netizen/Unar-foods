import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hashPassword, verifyPassword } from "../../src/lib/auth/password.ts";
import { paymentMatchesOrder, browserPaymentStatus } from "../../src/lib/commerce/payment-validation.ts";
import { starterPublicationPlan } from "../../src/lib/db/starter-catalog.ts";
import { swipeDirection } from "../../src/lib/gallery/swipe.ts";

const data = JSON.parse(readFileSync(new URL("../../src/lib/db/data/initial-data.json", import.meta.url), "utf8"));
const seed = data.products[0];
const urls = data.product_images.filter((i) => i.product_id === seed.id && i.sort_order <= 5).map((i) => i.url);
const images = urls.map((url) => ({ url, alt: "Actual product photo" }));
const variants = [{ is_active: 1, price_paise: 14900, mrp_paise: 14900, stock: 0 }];
const original = () => ({ ...seed, status: "draft", published_at: null, created_at: "2026-10-10 10:00:00.000", updated_at: "2026-10-10 10:00:00.000", owner_edited: 0 });

test("untouched starter drafts may publish with zero stock", () => {
  assert.equal(starterPublicationPlan(original(), seed, variants, images, urls), true);
});
for (const [description, change] of [
  ["owner-edited timestamp", { updated_at: "2026-10-10 10:01:00.000" }],
  ["owner audit record", { owner_edited: 1 }],
  ["unpublished product", { published_at: "2026-10-09 10:00:00.000" }],
  ["archived product", { status: "archived" }],
  ["edited ingredients", { ingredients: "Owner's ingredients" }],
  ["other ID", { id: "other-product" }],
]) test(`catalog repair preserves ${description}`, () => {
  assert.equal(starterPublicationPlan({ ...original(), ...change }, seed, variants, images, urls), false);
});
test("database JSON key order does not change the migration decision", () => {
  const row = original();
  row.claims = JSON.stringify(seed.claims.map(({ label, approved }) => ({ approved, label })));
  row.benefits = JSON.stringify(seed.benefits.map(({ label, approved }) => ({ approved, label })));
  row.is_featured = 1;
  assert.equal(starterPublicationPlan(row, seed, variants, images, urls), true);
});
test("incomplete gallery or invalid price cannot auto-publish", () => {
  assert.equal(starterPublicationPlan(original(), seed, variants, images.slice(1), urls), false);
  assert.equal(starterPublicationPlan(original(), seed, [{ ...variants[0], price_paise: 15000 }], images, urls), false);
  assert.equal(starterPublicationPlan(original(), seed, [{ ...variants[0], is_active: 0 }], images, urls), false);
});
test("both confirmed starters are published, correctly priced, and have five ordered photos", () => {
  assert.equal(data.products.length, 2);
  for (const [i, product] of data.products.entries()) {
    assert.equal(product.status, "published");
    const variant = data.product_variants.find((v) => v.product_id === product.id);
    assert.equal(variant.mrp_paise, i === 0 ? 14900 : 12000);
    assert.equal(variant.price_paise, variant.mrp_paise);
    assert.equal(variant.stock, 0);
    assert.equal(variant.weight_grams, 100);
    const photos = data.product_images.filter((p) => p.product_id === product.id && p.sort_order <= 5).sort((a,b) => a.sort_order-b.sort_order);
    assert.deepEqual(photos.map((p) => p.sort_order), [1,2,3,4,5]);
    assert.ok(photos[0].url.includes("01-main-hero-pouch"));
    for (const photo of photos) {
      const bytes = readFileSync(new URL(`../../public${photo.url}`, import.meta.url));
      assert.equal(bytes.toString("ascii",0,4), "RIFF");
      assert.equal(bytes.toString("ascii",8,12), "WEBP");
      assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
    }
  }
});

const payment = { id: "pay_1", order_id: "order_1", amount: 14900, currency: "INR" };
const expected = { paymentId: "pay_1", providerOrderId: "order_1", totalPaise: 14900 };
test("matching provider payment validates", () => assert.equal(paymentMatchesOrder(payment, expected), "valid"));
for (const [description, patch, result] of [
  ["wrong payment", { id: "pay_2" }, "invalid"],
  ["wrong order", { order_id: "order_2" }, "invalid"],
  ["wrong amount", { amount: 12000 }, "amount_mismatch"],
  ["wrong currency", { currency: "USD" }, "amount_mismatch"],
  ["fractional amount", { amount: 14900.1 }, "amount_mismatch"],
  ["negative amount", { amount: -1 }, "amount_mismatch"],
]) test(`rejects ${description} before capture`, () => assert.equal(paymentMatchesOrder({ ...payment, ...patch }, expected), result));

test("gallery recognizes deliberate horizontal swipes", () => {
  assert.equal(swipeDirection({ x: 100, y: 100 }, { x: 20, y: 105 }), 1);
  assert.equal(swipeDirection({ x: 100, y: 100 }, { x: 180, y: 105 }), -1);
});
test("gallery ignores taps, vertical scroll and diagonal movement", () => {
  for (const end of [{x:125,y:100},{x:160,y:200},{x:160,y:160}]) assert.equal(swipeDirection({x:100,y:100},end),0);
});
test("password hashes are salted and reject incorrect passwords", async () => {
  const one = await hashPassword("TestPass123");
  const two = await hashPassword("TestPass123");
  assert.notEqual(one, two);
  assert.equal(await verifyPassword("TestPass123", one), true);
  assert.equal(await verifyPassword("WrongPass123", one), false);
});
test("malformed stored scrypt hashes fail safely instead of crashing login", async () => {
  const hash = await hashPassword("TestPass123");
  for (const bad of [null, "", "scrypt$broken", hash.replace("$16384$", "$16385$"), hash.replace("$8$", "$NaN$"), hash.replace("$1$", "$999999$"), hash.slice(0,-4)]) assert.equal(await verifyPassword("TestPass123",bad),false);
});

test("checkout never reports a mismatched payment as paid", () => {
  assert.equal(browserPaymentStatus("amount_mismatch"), "invalid");
  assert.equal(browserPaymentStatus("paid"), "paid");
  assert.equal(browserPaymentStatus("already_paid"), "paid");
  assert.equal(browserPaymentStatus("pending"), "pending");
  assert.equal(browserPaymentStatus("failed"), "failed");
});
