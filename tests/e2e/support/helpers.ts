import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "owner@unar.local";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "OwnerPass123";
export const WEBHOOK_SECRET = process.env.E2E_RAZORPAY_WEBHOOK_SECRET ?? "local_mock_webhook_secret";
export const CRON_SECRET = process.env.E2E_CRON_SECRET ?? "local_cron_secret_for_tests_0123456789";
export const MOCK_RAZORPAY = "http://127.0.0.1:4010";
export const PRODUCT_PATH = "/products/banana-chewy-dry-fruits-seeds";

const stub = fs.readFileSync(path.join(__dirname, "razorpay-checkout-stub.js"), "utf8");

/** Replaces Razorpay's real checkout window with a local test double. */
export async function stubRazorpayCheckout(context: BrowserContext) {
  await context.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: stub }),
  );
}

export async function setPaymentMode(page: Page, mode: "success" | "fail" | "dismiss" | "tamper") {
  await page.evaluate((m) => localStorage.setItem("rzpMode", m), mode);
}

export async function addProductToCart(page: Page) {
  await page.goto(PRODUCT_PATH);
  await page.getByRole("button", { name: /Add to cart: /i }).first().click();
  await expect(page.getByRole("dialog").getByText("Your cart")).toBeVisible();
}

export async function fillCheckout(page: Page, opts: { method: "online" | "cod"; email?: string; coupon?: string }) {
  await page.goto("/checkout");
  await page.fill("#email", opts.email ?? `e2e+${Date.now()}@example.com`);
  await page.fill("#phone", "9876543210");
  await page.fill("#shipping-full_name", "Test Customer");
  await page.fill("#shipping-phone", "9876543210");
  await page.fill("#shipping-pincode", "641664");
  await page.fill("#shipping-line1", "12 Main Road");
  await page.fill("#shipping-city", "Palladam");
  await page.selectOption("#shipping-state", "Tamil Nadu");
  if (opts.coupon) {
    await page.getByPlaceholder("Coupon code").fill(opts.coupon);
    await page.getByRole("button", { name: "Apply" }).click();
  }
  await page.getByText(opts.method === "cod" ? "Cash on Delivery" : "Pay online", { exact: true }).click();
  await page.locator("#terms").check();
  await expect(page.getByTestId("checkout-total")).toBeVisible();
}

export async function loginAsAdmin(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login?next=/admin");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin"));
  await page.close();
  return context;
}

export function signWebhook(body: string, secret = WEBHOOK_SECRET) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export async function latestMockOrder(): Promise<{ id: string; amount: number }> {
  const state = (await (await fetch(`${MOCK_RAZORPAY}/__state`)).json()) as { orders: { id: string; amount: number; created_at: number }[] };
  const order = state.orders.at(-1);
  if (!order) throw new Error("No mock Razorpay order yet");
  return order;
}

export function priceOf(text: string): number {
  return Number(text.replace(/[^\d.]/g, ""));
}

/**
 * Clears the shop's rate-limit counters in the LOCAL test database, so a long
 * test run isn't blocked by the sign-up/newsletter limits. Refuses anything
 * but a local or private database server.
 */
export async function resetRateLimits() {
  if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
  const host = process.env.DB_HOST ?? "";
  if (!/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return;
  const mysql = await import("mysql2/promise");
  const db = await mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    await db.query("DELETE FROM rate_limits");
  } finally {
    await db.end();
  }
}
