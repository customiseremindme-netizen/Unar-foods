import { expect, test } from "@playwright/test";
import { addProductToCart, fillCheckout, loginAsAdmin } from "./support/helpers";

test("COD checkout works without online payments and produces a private unpaid invoice", async ({ browser, page, request }) => {
  const admin = await loginAsAdmin(browser), settings = await admin.newPage();
  settings.on("dialog", (dialog) => dialog.accept());
  await settings.goto("/admin/settings");
  const card = settings.locator("#set-checkout");
  const online = settings.locator("#checkout-online_payments_enabled"), original = await online.isChecked();
  try {
    await online.uncheck();
    await card.getByRole("button", { name: "Save", exact: true }).click();
    await expect(settings.getByText(/saved/i).first()).toBeVisible();
    await addProductToCart(page);
    await fillCheckout(page, { method: "cod" });
    await expect(page.getByText("Cash on Delivery", { exact: true })).toBeVisible();
    await expect(page.getByText("Pay online", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Place order", exact: true }).click();
    await page.waitForURL(/\/orders\/UNAR-\d+/);
    const href = await page.getByRole("link", { name: "View / download invoice" }).getAttribute("href");
    expect(href).toContain("token=");
    const invoice = await request.get(href!);
    expect(invoice.status()).toBe(200);
    expect(await invoice.text()).toContain("Payment has not been collected");
    expect((await request.get(href!.split("?")[0])).status()).toBe(404);
    const orderNumber = page.url().match(/UNAR-\d+/)![0];
    const orders = await admin.newPage();
    await orders.goto(`/admin/orders?q=${encodeURIComponent(orderNumber)}`);
    await orders.getByRole("link", { name: orderNumber, exact: true }).click();
    const staffInvoiceHref = await orders.getByRole("link", { name: "Invoice", exact: true }).getAttribute("href");
    expect(staffInvoiceHref).toBe(href!.split("?")[0]);
    const staffInvoice = await admin.request.get(staffInvoiceHref!);
    expect(staffInvoice.status()).toBe(200);
    expect(await staffInvoice.text()).toContain("Payment has not been collected");
  } finally {
    await online.setChecked(original);
    if (await card.getByRole("button", { name: "Save", exact: true }).isEnabled()) {
      await card.getByRole("button", { name: "Save", exact: true }).click();
      await expect(settings.getByText(/saved/i).first()).toBeVisible();
    }
    await admin.close();
  }
});

test("Google sign-in uses state and PKCE and rejects a forged callback", async ({ request }) => {
  const start = await request.get("/auth/google?next=/account", { maxRedirects: 0 });
  expect(start.status()).toBe(307);
  const location = new URL(start.headers().location);
  expect(location.origin).toBe("https://accounts.google.com");
  expect(location.searchParams.get("code_challenge_method")).toBe("S256");
  expect(location.searchParams.get("nonce")?.length).toBeGreaterThan(20);
  expect(location.searchParams.get("state")?.length).toBeGreaterThan(20);
  expect(start.headers()["set-cookie"]).toContain("HttpOnly");
  const rejected = await request.get("/auth/google/callback?code=forged&state=incorrect", { maxRedirects: 0 });
  expect(rejected.status()).toBe(307);
  expect(rejected.headers().location).toContain("/login?error=google");
  const account = await request.get("/account", { maxRedirects: 0 });
  expect(account.headers().location).toContain("/login");
});

test("search metadata and AI guide expose only published public products", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("shop?collection=banana-chewy");
  const guide = await request.get("/llms.txt");
  if (guide.status() === 200) {
    const body = await guide.text();
    expect(body).toContain("banana-chewy-dry-fruits-seeds");
    expect(body).not.toContain("owner@unar.local");
    expect(body).not.toContain("auth_identities");
  } else { expect(guide.status()).toBe(404); }
});

test("Google button starts a document navigation only after a click", async ({ page }) => {
  let starts = 0;
  // Intercept the first request: Playwright routes do not intercept the next
  // URL in a redirected navigation. Do not depend on Google's external pages
  // or treat this navigation fixture as a completed provider authentication.
  await page.route("**/auth/google?**", async (route) => {
    starts++;
    expect(route.request().isNavigationRequest()).toBe(true);
    expect(route.request().resourceType()).toBe("document");
    const response = await route.fetch({ maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const destination = new URL(response.headers().location);
    expect(destination.origin).toBe("https://accounts.google.com");
    expect(destination.searchParams.get("code_challenge_method")).toBe("S256");
    await route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Test-only OAuth navigation intercepted</h1>" });
  });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  expect(starts).toBe(0);
  await page.getByRole("link", { name: "Continue with Google", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test-only OAuth navigation intercepted" })).toBeVisible();
  expect(starts).toBe(1);
});
