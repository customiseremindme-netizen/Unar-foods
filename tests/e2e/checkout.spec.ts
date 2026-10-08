import { expect, test } from "@playwright/test";
import { addProductToCart, fillCheckout, latestMockOrder, loginAsAdmin, setPaymentMode, signWebhook, stubRazorpayCheckout, CRON_SECRET } from "./support/helpers";

test.describe("checkout", () => {
  test.beforeEach(async ({ context }) => {
    await stubRazorpayCheckout(context);
  });

  test("cash on delivery order is placed", async ({ page }) => {
    await addProductToCart(page);
    await fillCheckout(page, { method: "cod" });
    await page.getByRole("button", { name: /Place order/i }).click();
    await page.waitForURL(/\/orders\/UNAR-\d+/);
    await expect(page.locator("main")).toContainText(/UNAR-\d+/);
    await expect(page.locator("main")).toContainText(/Cash on Delivery/i);
  });

  test("successful online payment is verified on the server", async ({ page }) => {
    await addProductToCart(page);
    await setPaymentMode(page, "success");
    await fillCheckout(page, { method: "online" });
    await page.getByRole("button", { name: /Continue to payment/i }).click();
    await page.waitForURL(/\/orders\/UNAR-\d+/);
    await expect(page.locator("main")).toContainText(/Payment received|paid/i);
  });

  test("failed payment shows a clear message and no confirmation", async ({ page }) => {
    await addProductToCart(page);
    await setPaymentMode(page, "fail");
    await fillCheckout(page, { method: "online" });
    await page.getByRole("button", { name: /Continue to payment/i }).click();
    await expect(page.getByRole("heading", { name: "Payment not completed" })).toBeVisible();
    await expect(page.locator("main")).toContainText("Card declined");
    await expect(page.locator("main")).toContainText("not been charged");
  });

  test("a forged payment signature is never treated as paid", async ({ page }) => {
    await addProductToCart(page);
    await setPaymentMode(page, "tamper");
    await fillCheckout(page, { method: "online" });
    await page.getByRole("button", { name: /Continue to payment/i }).click();
    await page.waitForURL(/\/orders\/UNAR-\d+/);
    await expect(page.locator("main")).not.toContainText(/Payment received/i);
  });

  test("webhook confirms a payment after the customer closed the window", async ({ page, request }) => {
    await addProductToCart(page);
    await setPaymentMode(page, "dismiss");
    await fillCheckout(page, { method: "online" });
    await page.getByRole("button", { name: /Continue to payment/i }).click();
    await expect(page.getByRole("heading", { name: "Payment not completed" })).toBeVisible();

    const order = await latestMockOrder();
    const paymentId = `pay_${order.id.slice(6)}`;
    const body = JSON.stringify({
      entity: "event",
      event: "payment.captured",
      payload: { payment: { entity: { id: paymentId, entity: "payment", order_id: order.id, amount: order.amount, currency: "INR", status: "captured", method: "upi", captured: true } } },
      created_at: Math.floor(Date.now() / 1000),
    });
    const eventId = `evt_e2e_${Date.now()}`;
    const send = (signature: string) =>
      request.post("/api/webhooks/razorpay", { data: body, headers: { "content-type": "application/json", "x-razorpay-signature": signature, "x-razorpay-event-id": eventId } });

    expect((await send("not-a-valid-signature")).status()).toBe(401);
    const ok = await send(signWebhook(body));
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
    const replay = await send(signWebhook(body));
    expect(await replay.json()).toMatchObject({ duplicate: true });
  });

  test("tampered amount in a webhook does not mark the order paid", async ({ page, request, browser }) => {
    await addProductToCart(page);
    await setPaymentMode(page, "dismiss");
    await fillCheckout(page, { method: "online" });
    await page.getByRole("button", { name: /Continue to payment/i }).click();
    await expect(page.getByRole("heading", { name: "Payment not completed" })).toBeVisible();
    const orderNumber = (await page.locator("main").innerText()).match(/UNAR-\d+/)![0];
    const order = await latestMockOrder();
    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: `pay_${order.id.slice(6)}`, order_id: order.id, amount: 100, currency: "INR", status: "captured", method: "upi", captured: true } } },
    });
    const res = await request.post("/api/webhooks/razorpay", { data: body, headers: { "content-type": "application/json", "x-razorpay-signature": signWebhook(body), "x-razorpay-event-id": `evt_amt_${Date.now()}` } });
    expect(res.status()).toBe(200);
    // The dashboard must not show it as paid.
    const admin = await loginAsAdmin(browser);
    const adminPage = await admin.newPage();
    await adminPage.goto(`/admin/orders?q=${orderNumber}`);
    const row = adminPage.getByRole("row", { name: new RegExp(orderNumber) });
    await expect(row).toBeVisible();
    await expect(row).not.toContainText(/· paid/i);
    await admin.close();
  });

  test("payment check job requires its secret", async ({ request }) => {
    expect((await request.get("/api/cron/reconcile")).status()).toBe(401);
    const res = await request.get("/api/cron/reconcile", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    expect(res.status()).toBe(200);
  });
});
