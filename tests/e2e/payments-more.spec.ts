import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { addProductToCart, fillCheckout, loginAsAdmin, MOCK_RAZORPAY, resetRateLimits } from "./support/helpers";

/**
 * PhonePe Payment Gateway (against the local PhonePe stand-in) and
 * "Pay by UPI to our UPI ID" (Google Pay / PhonePe Business, confirmed by staff).
 */
const phonepe = (scenario: "success" | "fail" | "abandon" | "tamper") =>
  fetch(`${MOCK_RAZORPAY}/__phonepe`, { method: "POST", body: JSON.stringify({ scenario }) });

async function checkoutWith(page: Page, label: string, email?: string) {
  await addProductToCart(page);
  await page.goto("/checkout");
  await page.fill("#email", email ?? `pay+${Date.now()}@example.com`);
  await page.fill("#phone", "9876543210");
  await page.fill("#shipping-full_name", "Test Customer");
  await page.fill("#shipping-phone", "9876543210");
  await page.fill("#shipping-pincode", "641664");
  await page.fill("#shipping-line1", "12 Main Road");
  await page.fill("#shipping-city", "Palladam");
  await page.selectOption("#shipping-state", "Tamil Nadu");
  await page.getByText(label, { exact: true }).click();
  await page.locator("#terms").check();
  await expect(page.getByTestId("checkout-total")).toBeVisible();
}

test.describe("PhonePe Payment Gateway", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test("a successful PhonePe payment is checked with PhonePe and confirms the order", async ({ page }) => {
    await phonepe("success");
    await checkoutWith(page, "Pay with PhonePe");
    await page.getByRole("button", { name: /Continue to payment/i }).click();
    await page.waitForURL(/\/orders\/UNAR-\d+\?.*payment=success/);
    await expect(page.locator("main")).toContainText(/is confirmed/i);
    await expect(page.locator("main")).toContainText("Online (PhonePe)");
  });

  test("a failed PhonePe payment leaves the order unpaid with a clear message and a retry", async ({ page }) => {
    await phonepe("fail");
    await checkoutWith(page, "Pay with PhonePe");
    await page.getByRole("button", { name: /Continue to payment/i }).click();
    await page.waitForURL(/payment=failed/);
    await expect(page.getByText(/not completed and you have not been charged/i)).toBeVisible();
    // Retry goes back to PhonePe with a new attempt, which now succeeds.
    await phonepe("success");
    await page.getByRole("button", { name: "Complete payment" }).click();
    await page.waitForURL(/payment=success/);
    await expect(page.locator("main")).toContainText(/is confirmed/i);
  });

  test("a payment for the wrong amount is not treated as paid", async ({ page, browser }) => {
    await phonepe("tamper");
    await checkoutWith(page, "Pay with PhonePe");
    await page.getByRole("button", { name: /Continue to payment/i }).click();
    await page.waitForURL(/\/orders\/UNAR-\d+/);
    const orderNumber = /UNAR-\d+/.exec(page.url())![0];
    const admin = await loginAsAdmin(browser);
    const ap = await admin.newPage();
    await ap.goto("/admin/orders");
    await ap.getByRole("link", { name: orderNumber }).first().click();
    await expect(ap.locator("body")).toContainText(/does not match the order total/i);
    await admin.close();
    await phonepe("success");
  });

  test("webhooks need PhonePe's credentials, and only ever trigger a status check", async ({ request }) => {
    const body = { event: "checkout.order.completed", payload: { merchantOrderId: "UNAR-999999-abc", state: "COMPLETED" } };
    expect((await request.post("/api/webhooks/phonepe", { data: body })).status()).toBe(401);
    expect((await request.post("/api/webhooks/phonepe", { data: body, headers: { authorization: "wrong" } })).status()).toBe(401);
    const auth = createHash("sha256").update("unar_hook:local_hook_password").digest("hex");
    const ok = await request.post("/api/webhooks/phonepe", { data: body, headers: { authorization: auth } });
    expect(ok.status()).toBe(200);
  });

  test("a forged return from PhonePe doesn't mark anything paid", async ({ page }) => {
    await page.goto("/api/payments/phonepe/return?order=UNAR-001001&m=UNAR-001001-made-up");
    await expect(page).not.toHaveURL(/payment=success/);
  });
});

test.describe("UPI to the shop's own UPI ID", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test("customer sees the QR code, sends the UTR, staff confirm and the invoice follows", async ({ page, browser }) => {
    await checkoutWith(page, "Pay by UPI to our UPI ID");
    await page.getByRole("button", { name: /Place order/i }).click();
    await page.waitForURL(/\/orders\/UNAR-\d+/);
    const orderNumber = /UNAR-\d+/.exec(page.url())![0];
    await expect(page.getByText(/please pay by UPI to confirm it/i)).toBeVisible();
    await expect(page.getByRole("img", { name: /UPI QR code to pay/ })).toBeVisible();
    const link = await page.getByRole("link", { name: "Open my UPI app" }).getAttribute("href");
    expect(link).toMatch(/^upi:\/\/pay\?pa=unar\.test%40okaxis&pn=UNAR%20TEST&am=\d+\.\d{2}&cu=INR&tn=Order%20UNAR-\d+&tr=UNAR-\d+$/);
    // Not paid yet: no invoice.
    const token = new URL(page.url()).searchParams.get("token");
    expect((await page.request.get(`/invoice/${orderNumber}/pdf?token=${token}`)).status()).toBe(404);

    await page.fill("#upi-utr", "12-34-56!");
    await page.getByRole("button", { name: "I've paid" }).click();
    await expect(page.getByText(/exactly as your UPI app shows it/i)).toBeVisible();
    const utr = `4${Date.now().toString().slice(-11)}`;
    await page.fill("#upi-utr", utr);
    await page.getByRole("button", { name: "I've paid" }).click();
    await expect(page.getByText(/checking your UPI payment/i)).toBeVisible();
    await expect(page.locator("main")).toContainText(utr);
    // The customer can no longer cancel it themselves once they say they paid.
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

    const admin = await loginAsAdmin(browser);
    const ap = await admin.newPage();
    ap.on("dialog", (d) => d.accept());
    await ap.goto("/admin/orders");
    await ap.getByRole("link", { name: orderNumber }).first().click();
    await expect(ap.getByText(new RegExp(`reference ${utr}`)).first()).toBeVisible();
    await expect(ap.locator("#upi-ref")).toHaveValue(utr);
    await ap.getByRole("button", { name: "Confirm UPI payment received" }).click();
    await expect(ap.getByText(/UPI payment confirmed/i)).toBeVisible();
    await admin.close();

    await page.reload();
    await expect(page.locator("main")).toContainText(/is confirmed/i);
    expect((await page.request.get(`/invoice/${orderNumber}/pdf?token=${token}`)).status()).toBe(200);
  });

  test("the same UPI reference can't confirm two orders", async ({ page, browser }) => {
    const utr = `5${Date.now().toString().slice(-11)}`;
    const orders: string[] = [];
    for (let i = 0; i < 2; i++) {
      await checkoutWith(page, "Pay by UPI to our UPI ID");
      await page.getByRole("button", { name: /Place order/i }).click();
      await page.waitForURL(/\/orders\/UNAR-\d+/);
      orders.push(/UNAR-\d+/.exec(page.url())![0]);
    }
    const admin = await loginAsAdmin(browser);
    const ap = await admin.newPage();
    ap.on("dialog", (d) => d.accept());
    for (const [i, orderNumber] of orders.entries()) {
      await ap.goto("/admin/orders");
      await ap.getByRole("link", { name: orderNumber }).first().click();
      await ap.fill("#upi-ref", utr);
      await ap.getByRole("button", { name: "Confirm UPI payment received" }).click();
      await expect(ap.getByText(i === 0 ? /UPI payment confirmed/i : /already used to confirm another order/i)).toBeVisible();
    }
    await admin.close();
  });
});
