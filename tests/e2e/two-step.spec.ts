import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { ADMIN_EMAIL, ADMIN_PASSWORD, MOCK_RAZORPAY, resetRateLimits } from "./support/helpers";
import { currentStep, totpCode } from "../../src/lib/auth/totp";

/** Switches the "staff must use two-step sign-in" rule in the LOCAL test database. */
async function setStaffRule(on: boolean) {
  if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
  const mysql = await import("mysql2/promise");
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  try {
    await db.query("UPDATE settings SET value = JSON_SET(value, '$.require_staff_two_step', ?) WHERE `key` = 'security'", [on]);
  } finally {
    await db.end();
  }
}

async function googleSignIn(page: Page, user: { sub: string; email: string }) {
  await fetch(`${MOCK_RAZORPAY}/__google`, { method: "POST", body: JSON.stringify({ ...user, name: "Two Step", email_verified: true }) });
  await page.goto("/login");
  await page.getByRole("link", { name: "Continue with Google" }).click();
}

test.describe("two-step sign-in", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test("set up with an authenticator app; every later sign-in needs a fresh code or a one-time recovery code", async ({ page }) => {
    const stamp = Date.now();
    const user = { sub: `g-2fa-${stamp}`, email: `twostep+${stamp}@example.com` };
    await googleSignIn(page, user);
    await page.waitForURL(/\/account/);
    await page.goto("/account/security");
    await page.getByRole("button", { name: "Set up two-step sign-in" }).click();
    await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
    const secret = (await page.locator("p.font-mono").textContent())!.trim();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    await page.fill("#setup-code", "000000");
    await page.getByRole("button", { name: "Switch on" }).click();
    await expect(page.getByText(/didn't match/)).toBeVisible();
    await page.fill("#setup-code", totpCode(secret, currentStep()));
    await page.getByRole("button", { name: "Switch on" }).click();
    const codeList = page.getByRole("list", { name: "Recovery codes" }).locator("li");
    await expect(codeList).toHaveCount(10);
    const codes = await codeList.allTextContents();
    expect(codes).toHaveLength(10);
    await page.getByRole("button", { name: "I've saved them" }).click();
    await expect(page.getByText(/On · 10 recovery codes left/)).toBeVisible();

    // A new sign-in stops at the code step; the account isn't usable yet.
    await page.context().clearCookies();
    await googleSignIn(page, user);
    await page.waitForURL(/\/login\/two-step/);
    await page.goto("/account/orders");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/login/two-step?next=/account/orders");
    await page.fill("#code", "123456");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/That code didn't work/)).toBeVisible();
    // The next code (one step ahead is allowed for clock drift) works.
    await page.fill("#code", totpCode(secret, currentStep() + 1));
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/account\/orders/);

    // Recovery code: works once.
    await page.context().clearCookies();
    await googleSignIn(page, user);
    await page.waitForURL(/\/login\/two-step/);
    await page.getByRole("button", { name: /Use a recovery code/ }).click();
    await page.fill("#code", codes[0]!);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/account/);
    await page.context().clearCookies();
    await googleSignIn(page, user);
    await page.waitForURL(/\/login\/two-step/);
    await page.getByRole("button", { name: /Use a recovery code/ }).click();
    await page.fill("#code", codes[0]!);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/That code didn't work/)).toBeVisible();
  });

  test("when two-step is required, staff without it can't open the dashboard or its data", async ({ page }) => {
    await setStaffRule(true);
    try {
      await page.goto("/login");
      await page.fill("#email", ADMIN_EMAIL);
      await page.fill("#password", ADMIN_PASSWORD);
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await page.waitForURL(/\/account/);
      await page.goto("/admin");
      await page.waitForURL(/\/account\/security\?required=1/);
      await expect(page.getByText(/must switch this on before the dashboard opens/)).toBeVisible();
      await page.goto("/admin/orders");
      await expect(page).toHaveURL(/\/account\/security/);
      expect((await page.request.get("/admin/export/orders")).status()).toBe(403);
    } finally {
      await setStaffRule(false);
    }
  });

  test("a customer can delete their account; staff can't delete theirs here", async ({ page }) => {
    const stamp = Date.now();
    const user = { sub: `g-del-${stamp}`, email: `delete+${stamp}@example.com` };
    await googleSignIn(page, user);
    await page.waitForURL(/\/account/);
    await page.goto("/account/security");
    await page.getByText("I want to delete my account").click();
    const button = page.getByRole("button", { name: "Delete my account permanently" });
    await page.fill("#delete-confirm", "someone-else@example.com");
    await expect(button).toBeDisabled();
    await page.fill("#delete-confirm", user.email);
    await button.click();
    await page.waitForURL((url) => url.pathname === "/");
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);

    // The owner (staff) gets no delete option.
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/\/(account|admin)/);
    await page.goto("/account/security");
    await expect(page.getByText("I want to delete my account")).toHaveCount(0);
  });
});
