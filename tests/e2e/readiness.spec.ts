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

test("Google button starts a full browser OAuth navigation without prefetching", async ({ page }) => {
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Test-only Google consent destination</h1>" }));
  await page.goto("/login");
  await page.getByRole("link", { name: "Continue with Google", exact: true }).click();
  await page.waitForURL((url) => url.origin === "https://accounts.google.com");
  await expect(page.getByRole("heading", { name: "Test-only Google consent destination" })).toBeVisible();
});
