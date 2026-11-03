import { expect, test, type Page } from "@playwright/test";
import { MOCK_RAZORPAY, resetRateLimits } from "./support/helpers";

/**
 * "Continue with Google" against the local stand-in for Google
 * (GOOGLE_OAUTH_BASE_URL=http://127.0.0.1:4010/google, see tests/README.md).
 */
async function asGoogleUser(user: { sub: string; email: string; name?: string; email_verified?: boolean }) {
  await fetch(`${MOCK_RAZORPAY}/__google`, { method: "POST", body: JSON.stringify({ name: "Google User", email_verified: true, ...user }) });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

test.describe("Google sign-in", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test("a new customer signs up with Google and lands where they started", async ({ page }) => {
    const stamp = Date.now();
    await asGoogleUser({ sub: `g-${stamp}`, email: `google+${stamp}@example.com`, name: "Meera Google" });
    await page.goto("/login?next=/account/orders");
    await page.getByRole("link", { name: "Continue with Google" }).click();
    await page.waitForURL(/\/account\/orders/);
    await page.goto("/account/profile");
    await expect(page.locator("#full_name")).toHaveValue("Meera Google");
    // Signing in again finds the same account.
    await page.context().clearCookies();
    await page.goto("/register");
    await page.getByRole("link", { name: "Sign up with Google" }).click();
    await page.waitForURL(/\/account/);
    await expect(page.locator("body")).toContainText(`google+${stamp}@example.com`);
  });

  test("Google sign-in uses the existing account with the same email", async ({ page }) => {
    const stamp = Date.now();
    const email = `linked+${stamp}@example.com`;
    await page.goto("/register");
    await page.fill("#full_name", "Linked Person");
    await page.fill("#email", email);
    await page.fill("#password", "LinkedPass123");
    await page.fill("#confirm", "LinkedPass123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/sent a confirmation link|Almost done/i)).toBeVisible();
    // Google proves the email: the same account is used.
    await asGoogleUser({ sub: `g-linked-${stamp}`, email, name: "Linked Person" });
    await page.goto("/login");
    await page.getByRole("link", { name: "Continue with Google" }).click();
    await page.waitForURL(/\/account/);
    await expect(page.locator("body")).toContainText(email);
  });

  test("an unconfirmed sign-up by someone else can't keep its password once the real owner uses Google", async ({ page }) => {
    const stamp = Date.now();
    const email = `owner+${stamp}@example.com`;
    await page.goto("/register");
    await page.fill("#full_name", "Not The Owner");
    await page.fill("#email", email);
    await page.fill("#password", "SomeoneElse123");
    await page.fill("#confirm", "SomeoneElse123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/Almost done/i)).toBeVisible();
    await asGoogleUser({ sub: `g-owner-${stamp}`, email });
    await page.goto("/login");
    await page.getByRole("link", { name: "Continue with Google" }).click();
    await page.waitForURL(/\/account/);
    await page.context().clearCookies();
    await signIn(page, email, "SomeoneElse123");
    await expect(page.getByText(/Incorrect email or password/i)).toBeVisible();
  });

  test("a Google account without a verified email is refused", async ({ page }) => {
    await asGoogleUser({ sub: `g-unverified-${Date.now()}`, email: `unverified+${Date.now()}@example.com`, email_verified: false });
    await page.goto("/login");
    await page.getByRole("link", { name: "Continue with Google" }).click();
    await page.waitForURL(/\/login\?error=google/);
    await expect(page.getByText(/Google sign-in didn't work/i)).toBeVisible();
  });

  test("a forged return from Google is refused", async ({ page }) => {
    await page.goto("/auth/google/callback?code=made-up&state=made-up");
    await page.waitForURL(/\/login\?error=google/);
    await expect(page.getByText(/Google sign-in didn't work/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
