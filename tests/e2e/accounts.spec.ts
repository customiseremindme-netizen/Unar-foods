import path from "node:path";
import { loginAsAdmin, PRODUCT_PATH, addProductToCart, fillCheckout } from "./support/helpers";
import { expect, test, type Page } from "@playwright/test";

/**
 * Customer accounts: sign-up with email confirmation, sign-in, password reset.
 * Needs a local mail catcher (Mailpit) receiving the site's SMTP email:
 *   E2E_MAILPIT_URL=http://127.0.0.1:8025 npm run test:e2e
 */
const mailpit = process.env.E2E_MAILPIT_URL;

async function linkFromEmail(to: string, subject: RegExp): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string; Subject: string }[] };
    const msg = messages.find((m) => subject.test(m.Subject));
    if (msg) {
      const full = (await (await fetch(`${mailpit}/api/v1/message/${msg.ID}`)).json()) as { Text: string };
      const url = /(https?:\/\/\S+\/auth\/confirm\?\S+)/.exec(full.Text)?.[1];
      if (url) return url;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No "${subject}" email for ${to}`);
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

test.describe("accounts", () => {
  test.skip(!mailpit, "Set E2E_MAILPIT_URL to run the email tests");

  test("sign up, confirm by email, reset the password", async ({ page, browser, request }) => {
    const email = `account+${Date.now()}@example.com`;
    await page.goto("/register");
    await page.fill("#full_name", "Asha Customer");
    await page.fill("#email", email);
    await page.fill("#password", "FirstPass123");
    await page.fill("#confirm", "FirstPass123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/sent a confirmation link/i)).toBeVisible();

    // Not confirmed yet → can't sign in.
    await signIn(page, email, "FirstPass123");
    await expect(page.getByText(/confirm your email address first/i)).toBeVisible();

    // Opening the link alone does not use it up (protects against email scanners).
    const confirm = await linkFromEmail(email, /confirm/i);
    await page.goto(confirm);
    await page.getByRole("button", { name: /confirm my email/i }).click();
    await page.waitForURL((u) => u.pathname.startsWith("/account"));
    await expect(page.locator("body")).toContainText("Asha");

    // The same link can't be used twice.
    await page.context().clearCookies();
    await page.goto(confirm);
    await page.getByRole("button", { name: /confirm my email/i }).click();
    await page.waitForURL(/\/login\?error=link/);

    // Wrong password is refused with a neutral message.
    await signIn(page, email, "WrongPass123");
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();

    // Password reset.
    await page.goto("/forgot-password");
    await page.fill("#email", email);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/we've sent a link/i)).toBeVisible();
    const reset = await linkFromEmail(email, /reset/i);
    await page.goto(reset);
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL((u) => u.pathname === "/reset-password");
    await page.fill("#password", "SecondPass456");
    await page.fill("#confirm", "SecondPass456");
    await page.getByRole("button", { name: /update password|save|set password/i }).click();
    await expect(page.getByText("Your password has been updated.")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, email, "FirstPass123");
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await signIn(page, email, "SecondPass456");
    await page.waitForURL((u) => u.pathname.startsWith("/account"));

    await page.goto("/admin/customize");
    await expect(page).toHaveURL(/\/admin\/no-access/);
    await expect(page.getByRole("heading", { name: "This area is for UNAR staff" })).toBeVisible();
    await expect(page.locator("#set-appearance")).toHaveCount(0);

    // Uploaded review media stays private until a moderator approves the review.
    await page.goto(PRODUCT_PATH);
    await page.getByRole("button", { name: "5 stars", exact: true }).click();
    await page.fill("#review-name", "Asha Customer");
    const reviewTitle = `Media privacy ${Date.now()}`;
    await page.fill("#review-title", reviewTitle);
    await page.fill("#review-body", "An isolated test review used to verify moderation and upload privacy.");
    await page.locator("#review-files").setInputFiles(path.resolve("public/images/products/dry-fruits-seeds/01-main-hero-pouch.webp"));
    const uploaded = page.waitForResponse((r) => r.url().endsWith("/api/review-media") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Upload files" }).click();
    const response = await uploaded;
    expect(response.status()).toBe(201);
    const { media } = await response.json();
    const mediaPath = `/review-media/${media[0].id}`;
    expect((await page.request.get(mediaPath)).status()).toBe(200);
    expect((await request.get(mediaPath)).status()).toBe(404);
    await page.getByRole("button", { name: "Submit review", exact: true }).click();
    await expect(page.getByText(/review.*(approval|checked|moderation)|thank you/i).last()).toBeVisible();
    expect((await request.get(mediaPath)).status()).toBe(404);
    const adminContext = await loginAsAdmin(browser);
    try {
      const admin = await adminContext.newPage();
      await admin.goto("/admin/reviews");
      const row = admin.locator("li").filter({ hasText: reviewTitle }).first();
      await row.getByRole("button", { name: "Approve", exact: true }).click();
      await expect.poll(async () => (await request.get(mediaPath)).status()).toBe(200);
      await admin.goto("/admin/reviews?status=approved");
      await admin.locator("li").filter({ hasText: reviewTitle }).first().getByRole("button", { name: "Hide", exact: true }).click();
      await expect.poll(async () => (await request.get(mediaPath)).status()).toBe(404);
    } finally { await adminContext.close(); }

    await page.goto("/account/profile");
    await page.fill("#full_name", "Asha Updated");
    await page.fill("#phone", "9876543210");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Your details have been saved.")).toBeVisible();
    await page.reload();
    await expect(page.locator("#full_name")).toHaveValue("Asha Updated");
    await page.goto("/account/orders");
    await expect(page.getByText("No orders yet")).toBeVisible();
    await addProductToCart(page);
    await fillCheckout(page, { method: "cod", email });
    await page.getByRole("button", { name: /Place order/i }).click();
    await page.waitForURL(/\/orders\/UNAR-\d+/);
    const orderNumber = /UNAR-\d+/.exec(page.url())![0];
    await page.goto("/account/orders");
    await page.getByRole("link", { name: new RegExp(orderNumber) }).click();
    await expect(page.locator("main")).toContainText(orderNumber);
    await page.goto("/account/addresses");
    await expect(page.getByText("12 Main Road", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    await page.fill("#line1", "14 Updated Road");
    await page.getByRole("button", { name: "Save address", exact: true }).click();
    await expect(page.getByText("14 Updated Road", { exact: false })).toBeVisible();
    await page.reload();
    await expect(page.getByText("14 Updated Road", { exact: false })).toBeVisible();
    const restoredContext = await browser.newContext({ storageState: await page.context().storageState() });
    try {
      const restored = await restoredContext.newPage();
      await restored.goto("/account");
      await expect(restored.getByRole("heading", { name: "Hello, Asha" })).toBeVisible();
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await page.goto("/account");
      await page.waitForURL((u) => u.pathname === "/login");
      // Logout revokes the stored token on the server, including another browser context.
      await restored.goto("/account");
      await restored.waitForURL((u) => u.pathname === "/login");
    } finally { await restoredContext.close(); }
  });

  test("the setup page is closed once the owner exists", async ({ page }) => {
    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: "Your store is set up" })).toBeVisible();
  });
});
