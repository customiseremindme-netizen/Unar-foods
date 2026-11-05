import { expect, test, type Page } from "@playwright/test";
import { addProductToCart, MOCK_RAZORPAY, resetRateLimits } from "./support/helpers";

type WaMessage = { to: string; template: string; params: string[] };
const randomMobile = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;

/** The latest sign-in code sent to this number (read from the local WhatsApp stand-in). */
async function latestCode(phone: string): Promise<string> {
  let code = "";
  await expect
    .poll(async () => {
      const { messages } = (await (await fetch(`${MOCK_RAZORPAY}/__whatsapp_state`)).json()) as { messages: WaMessage[] };
      code = messages.filter((m) => m.template === "unar_login_code" && m.to === `91${phone}`).at(-1)?.params[0] ?? "";
      return code;
    })
    .toMatch(/^\d{6}$/);
  return code;
}

async function askForCode(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByRole("link", { name: "Sign in with mobile number" }).click();
  await page.fill("#pl-phone", phone);
  await page.getByRole("button", { name: "Send code on WhatsApp" }).click();
  await expect(page.getByText(/We sent a 6-digit code on WhatsApp/)).toBeVisible();
}

test.describe("sign in with mobile number (code on WhatsApp)", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test("a new customer signs up with a code, and later signs in with just the number", async ({ page }) => {
    const phone = randomMobile();
    await askForCode(page, phone);
    const code = await latestCode(phone);
    await page.fill("#pl-code", code === "000000" ? "111111" : "000000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/That code didn't work/)).toBeVisible();
    await page.fill("#pl-code", code);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/Tell us your name and email/)).toBeVisible();
    await page.fill("#pl-name", "Mobile Customer");
    await page.fill("#pl-email", `mobile+${phone}@example.com`);
    await page.getByRole("button", { name: "Create my account" }).click();
    await page.waitForURL((u) => u.pathname === "/account");
    await expect(page.getByText(`mobile+${phone}@example.com`).first()).toBeVisible();

    // A used code can't be used again; a fresh one signs straight in.
    await page.context().clearCookies();
    await askForCode(page, phone);
    const second = await latestCode(phone);
    expect(second).not.toBe("");
    await page.fill("#pl-code", second);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => u.pathname === "/account");
    await expect(page.getByText(`mobile+${phone}@example.com`).first()).toBeVisible();
  });

  test("an existing account links its number in Account → Security", async ({ page }) => {
    const stamp = Date.now();
    await fetch(`${MOCK_RAZORPAY}/__google`, { method: "POST", body: JSON.stringify({ sub: `g-phone-${stamp}`, email: `link+${stamp}@example.com`, name: "Link Phone", email_verified: true }) });
    await page.goto("/login");
    await page.getByRole("link", { name: "Continue with Google" }).click();
    await page.waitForURL(/\/account/);
    await page.goto("/account/security");
    const phone = randomMobile();
    await page.fill("#link-phone", phone);
    await page.getByRole("button", { name: "Send code on WhatsApp" }).click();
    await page.fill("#link-code", await latestCode(phone));
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(/On · \+91/)).toBeVisible();

    await page.context().clearCookies();
    await askForCode(page, phone);
    await page.fill("#pl-code", await latestCode(phone));
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => u.pathname === "/account");
    await expect(page.getByText(`link+${stamp}@example.com`).first()).toBeVisible();
  });

  test("if the real owner of the email signs in with Google, the number someone else linked is removed", async ({ page }) => {
    const phone = randomMobile();
    const email = `claim+${phone}@example.com`;
    await askForCode(page, phone);
    await page.fill("#pl-code", await latestCode(phone));
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.fill("#pl-name", "Someone Else");
    await page.fill("#pl-email", email);
    await page.getByRole("button", { name: "Create my account" }).click();
    await page.waitForURL((u) => u.pathname === "/account");

    // The real owner of the address arrives with Google.
    await page.context().clearCookies();
    await fetch(`${MOCK_RAZORPAY}/__google`, { method: "POST", body: JSON.stringify({ sub: `g-claim-${phone}`, email, name: "Real Owner", email_verified: true }) });
    await page.goto("/login");
    await page.getByRole("link", { name: "Continue with Google" }).click();
    await page.waitForURL((u) => u.pathname === "/account");

    // The number no longer opens that account: it's treated as new.
    await page.context().clearCookies();
    await resetRateLimits();
    await askForCode(page, phone);
    await page.fill("#pl-code", await latestCode(phone));
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/Tell us your name and email/)).toBeVisible();
  });

  test("checkout accepts a mobile number written with a leading 0 and a long address", async ({ page }) => {
    await addProductToCart(page);
    await page.goto("/checkout");
    await page.fill("#email", `lead0+${Date.now()}@example.com`);
    await page.fill("#phone", "09600908127");
    await page.fill("#shipping-full_name", "suryaprakash Rajkumar");
    await page.fill("#shipping-phone", "09600908127");
    await page.fill("#shipping-pincode", "641662");
    await page.fill("#shipping-line1", "1/354 H, Sri sastha illam, Asm garden, Samigoundanpalayam, Ksn puram");
    await page.fill("#shipping-line2", "palladam");
    await page.fill("#shipping-city", "Tiruppur");
    await page.selectOption("#shipping-state", "Tamil Nadu");
    await page.getByText("Cash on Delivery", { exact: true }).click();
    await page.locator("#terms").check();
    await page.getByRole("button", { name: /Place order/i }).click();
    await page.waitForURL(/\/orders\/UNAR-\d+/);
  });
});
