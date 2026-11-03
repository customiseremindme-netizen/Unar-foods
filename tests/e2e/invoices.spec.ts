import { expect, test } from "@playwright/test";
import { addProductToCart, fillCheckout, loginAsAdmin, setPaymentMode, stubRazorpayCheckout } from "./support/helpers";

/**
 * Invoices are emailed automatically as a PDF once money is received.
 * Needs the local mail catcher: E2E_MAILPIT_URL=http://127.0.0.1:8025
 */
const mailpit = process.env.E2E_MAILPIT_URL;

type MailSummary = { ID: string; Subject: string; Attachments: number };

async function mailFor(to: string, subject: RegExp): Promise<{ id: string; attachments: { FileName: string; ContentType: string }[] }> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await res.json()) as { messages: MailSummary[] };
    const msg = messages.find((m) => subject.test(m.Subject));
    if (msg) {
      const full = (await (await fetch(`${mailpit}/api/v1/message/${msg.ID}`)).json()) as { Attachments: { FileName: string; ContentType: string }[] };
      return { id: msg.ID, attachments: full.Attachments ?? [] };
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`No "${subject}" email for ${to}`);
}

test.describe("invoices", () => {
  test.skip(!mailpit, "Set E2E_MAILPIT_URL to run the email tests");

  test("an online payment's confirmation email carries the PDF invoice", async ({ page, context }) => {
    await stubRazorpayCheckout(context);
    const email = `invoice-online+${Date.now()}@example.com`;
    await addProductToCart(page);
    await setPaymentMode(page, "success");
    await fillCheckout(page, { method: "online", email });
    await page.getByRole("button", { name: /Continue to payment/i }).click();
    await page.waitForURL(/\/orders\/UNAR-\d+/);
    const orderNumber = /UNAR-\d+/.exec(page.url())![0];
    const mail = await mailFor(email, /payment received|confirmed/i);
    expect(mail.attachments).toEqual([expect.objectContaining({ FileName: `Invoice-${orderNumber}.pdf`, ContentType: "application/pdf" })]);
    // The attached file really is a PDF.
    const part = await fetch(`${mailpit}/api/v1/message/${mail.id}/part/${(await (await fetch(`${mailpit}/api/v1/message/${mail.id}`)).json()).Attachments[0].PartID}`);
    expect(Buffer.from(await part.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    // The customer can download it from the order page link too.
    const token = new URL(page.url()).searchParams.get("token");
    const pdf = await page.request.get(`/invoice/${orderNumber}/pdf${token ? `?token=${token}` : ""}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    // Nobody else can.
    const stranger = await page.context().browser()!.newContext();
    expect((await stranger.request.get(`/invoice/${orderNumber}/pdf`)).status()).toBe(404);
    await stranger.close();
  });

  test("cash on delivery: no invoice until the cash is collected, then it is emailed", async ({ page, browser }) => {
    const email = `invoice-cod+${Date.now()}@example.com`;
    await addProductToCart(page);
    await fillCheckout(page, { method: "cod", email });
    await page.getByRole("button", { name: /Place order/i }).click();
    await page.waitForURL(/\/orders\/UNAR-\d+/);
    const orderNumber = /UNAR-\d+/.exec(page.url())![0];
    const placed = await mailFor(email, /order/i);
    expect(placed.attachments).toEqual([]);
    const token = new URL(page.url()).searchParams.get("token");
    expect((await page.request.get(`/invoice/${orderNumber}/pdf${token ? `?token=${token}` : ""}`)).status()).toBe(404);

    const admin = await loginAsAdmin(browser);
    const ap = await admin.newPage();
    ap.on("dialog", (d) => d.accept());
    await ap.goto("/admin/orders");
    await ap.getByRole("link", { name: orderNumber }).first().click();
    await ap.getByRole("button", { name: "Mark COD payment collected" }).click();
    await expect(ap.getByText(/payment recorded/i)).toBeVisible();
    const invoice = await mailFor(email, /invoice/i);
    expect(invoice.attachments.map((a) => a.FileName)).toEqual([`Invoice-${orderNumber}.pdf`]);
    // The owner can email it again from the order page.
    await ap.getByRole("button", { name: "Email invoice (PDF) to customer" }).click();
    await expect(ap.getByText("Email sent.")).toBeVisible();
    await admin.close();
  });
});
