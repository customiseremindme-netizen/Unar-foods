import { expect, test, type Page } from "@playwright/test";
import { addProductToCart, loginAsAdmin, MOCK_RAZORPAY, resetRateLimits } from "./support/helpers";

/**
 * WhatsApp order updates (local stand-in for Meta's WhatsApp Cloud API) and
 * automatic courier tracking (local stand-in for Shiprocket).
 */
const COURIER_TOKEN = process.env.E2E_SHIPROCKET_WEBHOOK_TOKEN ?? "local_courier_token_0123456789";

type WaMessage = { to: string; template: string; params: string[] };
const allMessages = async (): Promise<WaMessage[]> => ((await (await fetch(`${MOCK_RAZORPAY}/__whatsapp_state`)).json()) as { messages: WaMessage[] }).messages;
/** Messages to the customer about this order (not the shop's own new-order alerts). */
const messagesFor = async (orderNumber: string): Promise<WaMessage[]> =>
  (await allMessages()).filter((m) => m.template !== "unar_new_order" && m.params.includes(orderNumber));

async function codOrder(page: Page, whatsapp: boolean): Promise<string> {
  await addProductToCart(page);
  await page.goto("/checkout");
  await page.fill("#email", `wa+${Date.now()}@example.com`);
  await page.fill("#phone", "9876543210");
  await page.fill("#shipping-full_name", "Meena Customer");
  await page.fill("#shipping-phone", "9876543210");
  await page.fill("#shipping-pincode", "641664");
  await page.fill("#shipping-line1", "12 Main Road");
  await page.fill("#shipping-city", "Palladam");
  await page.selectOption("#shipping-state", "Tamil Nadu");
  await page.getByText("Cash on Delivery", { exact: true }).click();
  if (whatsapp) await page.getByLabel(/order updates on WhatsApp/).check();
  await page.locator("#terms").check();
  await page.getByRole("button", { name: /Place order/i }).click();
  await page.waitForURL(/\/orders\/UNAR-\d+/);
  return /UNAR-\d+/.exec(page.url())![0];
}

test.describe("WhatsApp updates and courier tracking", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test("the shop owner gets a WhatsApp message for every new order, once", async ({ page }) => {
    const orderNumber = await codOrder(page, false);
    await expect.poll(async () => (await allMessages()).filter((m) => m.template === "unar_new_order" && m.params[0] === orderNumber).length).toBe(1);
    const msg = (await allMessages()).find((m) => m.template === "unar_new_order" && m.params[0] === orderNumber)!;
    expect(msg.to).toBe("919000000001");
    expect(msg.params[1]).toMatch(/^Meena Customer · ₹[\d.]+ · Cash on Delivery$/);
    expect(msg.params[2]).toMatch(/\/admin\/orders\/[0-9a-f-]{36}$/);
  });

  test("WhatsApp messages go only to customers who agreed", async ({ page }) => {
    const without = await codOrder(page, false);
    const withUpdates = await codOrder(page, true);
    await expect.poll(async () => (await messagesFor(withUpdates)).map((m) => m.template)).toEqual(["order_received"]);
    const [msg] = await messagesFor(withUpdates);
    expect(msg.to).toBe("919876543210");
    expect(msg.params[0]).toBe("Meena");
    expect(msg.params[2]).toMatch(/^https?:\/\//);
    expect(await messagesFor(without)).toEqual([]);
  });

  test("Shiprocket tracking moves the order to Shipped and Delivered by itself and tells the customer", async ({ page, browser, request }) => {
    const orderNumber = await codOrder(page, true);
    const admin = await loginAsAdmin(browser);
    const ap = await admin.newPage();
    ap.on("dialog", (d) => d.accept());
    await ap.goto("/admin/orders");
    await ap.getByRole("link", { name: orderNumber }).first().click();
    await expect(ap.getByRole("link", { name: "Message on WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/919876543210\?text=/);
    await ap.getByRole("button", { name: "Create in Shiprocket" }).click();
    await expect(ap.getByText(/Order created in Shiprocket/i)).toBeVisible();
    const state = (await (await fetch(`${MOCK_RAZORPAY}/__shiprocket_state`)).json()) as { shipments: { shipment_id: number; awb: string }[] };
    const shipment = state.shipments.at(-1)!;

    // Wrong token → refused.
    expect((await request.post("/api/webhooks/courier", { data: { shipment_id: shipment.shipment_id }, headers: { "x-api-key": "nope" } })).status()).toBe(401);

    // The courier picks it up: Shiprocket tells us, we fetch the tracking and mark it shipped.
    await fetch(`${MOCK_RAZORPAY}/__shiprocket`, { method: "POST", body: JSON.stringify({ shipment_id: shipment.shipment_id, status: "IN TRANSIT" }) });
    expect((await request.post("/api/webhooks/courier", { data: { shipment_id: shipment.shipment_id, current_status: "IN TRANSIT" }, headers: { "x-api-key": COURIER_TOKEN } })).status()).toBe(200);
    await ap.reload();
    await expect(ap.locator("body")).toContainText(shipment.awb);
    await expect(ap.locator("body")).toContainText(/Shipped/);
    await expect.poll(async () => (await messagesFor(orderNumber)).map((m) => m.template)).toContain("order_shipped");
    const shipped = (await messagesFor(orderNumber)).find((m) => m.template === "order_shipped")!;
    expect(shipped.params[2]).toContain(shipment.awb);

    // Delivered (now by AWB, as Shiprocket sends it).
    await fetch(`${MOCK_RAZORPAY}/__shiprocket`, { method: "POST", body: JSON.stringify({ shipment_id: shipment.shipment_id, status: "DELIVERED" }) });
    await request.post("/api/webhooks/courier", { data: { awb: shipment.awb, current_status: "DELIVERED" }, headers: { "x-api-key": COURIER_TOKEN } });
    await ap.reload();
    await expect(ap.locator("body")).toContainText(/Delivered/);
    await expect.poll(async () => (await messagesFor(orderNumber)).map((m) => m.template)).toContain("order_delivered");
    // Repeated updates don't send the same message twice.
    await request.post("/api/webhooks/courier", { data: { awb: shipment.awb }, headers: { "x-api-key": COURIER_TOKEN } });
    expect((await messagesFor(orderNumber)).filter((m) => m.template === "order_delivered")).toHaveLength(1);
    await admin.close();
  });
});
