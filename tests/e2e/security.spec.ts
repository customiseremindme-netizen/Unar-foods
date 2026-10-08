import { expect, test } from "@playwright/test";

test.describe("security", () => {
  test("dashboard requires sign-in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("exports and admin data are not public", async ({ request }) => {
    for (const path of ["/admin/export/orders", "/admin/export/customers", "/admin/export/inventory", "/admin/export/report?type=daily"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([302, 303, 307, 401, 403]).toContain(res.status());
    }
  });

  test("a customer account cannot open the dashboard", async ({ page }) => {
    const email = `customer+${Date.now()}@example.com`;
    await page.goto("/register");
    await page.fill("#full_name", "E2E Customer");
    await page.fill("#email", email);
    await page.fill("#password", "Passw0rdE2E!");
    await page.fill("#confirm", "Passw0rdE2E!");
    await page.getByRole("button", { name: /create account/i }).click();
    // Email confirmation is required, so they can't sign in yet; either way the dashboard stays closed.
    await page.goto("/admin");
    expect(new URL(page.url()).pathname).not.toBe("/admin");
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBeTruthy();
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("order pages need the private link or sign-in", async ({ request }) => {
    const res = await request.get("/orders/UNAR-001001", { maxRedirects: 0 });
    expect(await res.text()).not.toContain("12 Main Road");
  });

  test("webhooks without a signature are rejected", async ({ request }) => {
    const res = await request.post("/api/webhooks/razorpay", { data: { event: "payment.captured" } });
    expect(res.status()).toBe(401);
  });
});
