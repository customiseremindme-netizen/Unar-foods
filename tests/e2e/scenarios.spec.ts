import { expect, test, type Page } from "@playwright/test";
import { addProductToCart, fillCheckout, loginAsAdmin, priceOf, resetRateLimits } from "./support/helpers";

/**
 * The 22 acceptance scenarios from the owner's brief (docs/UPGRADE_BRIEF.md,
 * Phase 10). Scenarios already covered elsewhere are noted next to them:
 *   9  password reset            → accounts.spec.ts
 *   13 checkout (COD + Razorpay) → checkout.spec.ts
 *   15 admin price change        → admin.spec.ts (stock is checked here too)
 * Run against a LOCAL site only (see tests/README.md).
 */

const DRY = "/products/banana-chewy-dry-fruits-seeds";
const RAW = "/products/banana-chewy-fresh-raw-banana";
const DRY_NAME = "UNAR Dehydrated Banana Chewy — With Dry Fruits & Seeds";
const RAW_NAME = "UNAR Dehydrated Banana Chewy — Fresh Raw Banana";
const mailpit = process.env.E2E_MAILPIT_URL;

/** Collects browser errors so a test can assert there were none. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Download the React DevTools|favicon/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

/** A small, valid PNG made on the fly. */
async function samplePng(): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 46, g: 78, b: 54 } } }).png().toBuffer();
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= height; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(1200);
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

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

async function registerAndConfirm(page: Page, email: string, password: string, name = "Priya Tester") {
  await page.goto("/register");
  await page.fill("#full_name", name);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.fill("#confirm", password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText(/sent a confirmation link/i)).toBeVisible();
  await page.goto(await linkFromEmail(email, /confirm/i));
  await page.getByRole("button", { name: /confirm my email/i }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/account"));
}

// The shop limits sign-ups, messages and subscriptions per network; clear the counters of the LOCAL test database.
test.beforeEach(async () => {
  await resetRateLimits();
});

test.describe("brief scenarios — storefront", () => {
  test("1. homepage loads without errors", async ({ page }) => {
    const errors = watchErrors(page);
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await scrollThrough(page);
    expect(errors).toEqual([]);
  });

  test("2. both products appear on the homepage", async ({ page }) => {
    await page.goto("/");
    const shop = page.locator("#shop");
    await expect(shop.getByRole("heading", { name: DRY_NAME })).toBeVisible();
    await expect(shop.getByRole("heading", { name: RAW_NAME })).toBeVisible();
  });

  test("3. both products appear in Shop and in the Banana Chewy collection", async ({ page }) => {
    for (const path of ["/shop", "/shop?collection=banana-chewy"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: DRY_NAME })).toBeVisible();
      await expect(page.getByRole("heading", { name: RAW_NAME })).toBeVisible();
    }
  });

  test("4. product search finds both products", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /search/i }).first().click();
    await page.fill("#site-search", "banana chewy");
    const results = page.getByRole("list", { name: "Matching products" });
    await expect(results.getByText(DRY_NAME)).toBeVisible();
    await expect(results.getByText(RAW_NAME)).toBeVisible();
    // Searching by an ingredient narrows it down.
    await page.fill("#site-search", "cashew");
    await expect(results.getByText(DRY_NAME)).toBeVisible();
    await expect(results.getByText(RAW_NAME)).toHaveCount(0);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/shop\?q=cashew/);
    await expect(page.getByRole("heading", { name: DRY_NAME })).toBeVisible();
    await page.goto("/shop?q=banana");
    await expect(page.getByRole("heading", { name: RAW_NAME })).toBeVisible();
    await expect(page.getByRole("heading", { name: DRY_NAME })).toBeVisible();
  });

  test("5. product detail pages open with price, details and related products", async ({ page }) => {
    for (const [path, name] of [
      [DRY, DRY_NAME],
      [RAW, RAW_NAME],
    ]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveText(name);
      await expect(page.getByText("Net weight:")).toBeVisible();
      await expect(page.getByRole("button", { name: /Add to cart: /i }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Buy now" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Customer reviews" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "You may also like" })).toBeVisible();
    }
  });

  test("6. five images load for each product, in order, with a working gallery", async ({ page }) => {
    for (const path of [DRY, RAW]) {
      await page.goto(path);
      const thumbs = page.getByRole("group", { name: "Product images" }).getByRole("button");
      await expect(thumbs).toHaveCount(5);
      // Every gallery image really loads.
      const sizes = await page
        .locator("img[src*='/_next/image'], img[src*='/images/products/']")
        .evaluateAll((imgs) => imgs.filter((i) => (i as HTMLImageElement).alt).map((i) => (i as HTMLImageElement).naturalWidth));
      await page.waitForFunction(() =>
        [...document.querySelectorAll<HTMLImageElement>("[aria-label='Product images'] img")].every((i) => i.complete && i.naturalWidth > 0),
      );
      expect(sizes.length).toBeGreaterThanOrEqual(5);
      const srcs = await thumbs.locator("img").evaluateAll((imgs) => imgs.map((i) => decodeURIComponent((i as HTMLImageElement).src)));
      expect(srcs.map((s) => /\/(0\d)-/.exec(s)?.[1])).toEqual(["01", "02", "03", "04", "05"]);
      // Next / thumbnail / full screen / label view.
      await page.getByRole("button", { name: "Next image" }).first().click();
      await expect(page.locator("[aria-live=polite]").first()).toContainText("Image 2 of 5");
      await thumbs.nth(4).click();
      await expect(page.locator("[aria-live=polite]").first()).toContainText("Image 5 of 5");
      await page.getByRole("button", { name: /Open full-screen view/ }).click();
      const viewer = page.getByRole("dialog");
      await expect(viewer).toContainText("5 / 5");
      await page.keyboard.press("ArrowRight");
      await expect(viewer).toContainText("1 / 5");
      await viewer.getByRole("button", { name: "Zoom in" }).click();
      await page.keyboard.press("Escape");
      await expect(viewer).toHaveCount(0);
      await page.getByRole("button", { name: "Read the pack label" }).click();
      await expect(page.getByRole("dialog")).toContainText("pack label");
      await page.keyboard.press("Escape");
    }
  });

  test("11 + 12. add to cart works and cart totals are accurate", async ({ page }) => {
    await page.goto(DRY);
    const dryPrice = priceOf((await page.locator("#product-title ~ div").first().textContent()) ?? "");
    await page.getByRole("button", { name: "Increase quantity" }).first().click();
    await page.getByRole("button", { name: /Add to cart: /i }).first().click();
    await expect(page.getByRole("dialog").getByText("Your cart")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto(RAW);
    const rawPrice = priceOf((await page.locator("#product-title ~ div").first().textContent()) ?? "");
    await page.getByRole("button", { name: /Add to cart: /i }).first().click();
    await expect(page.getByRole("dialog").getByText("Your cart")).toBeVisible();
    expect(dryPrice).toBeGreaterThan(0);
    expect(rawPrice).toBeGreaterThan(0);
    await page.goto("/cart");
    const subtotal = page.locator("dt", { hasText: /Subtotal \(3 items\)/ }).locator("xpath=following-sibling::dd");
    await expect(subtotal).toHaveText(`₹${2 * dryPrice + rawPrice}`);
    // Cart survives a refresh (stored on the server).
    await page.reload();
    await expect(page.locator("dt", { hasText: /Subtotal \(3 items\)/ })).toBeVisible();
    // The checkout total matches too (COD fee and shipping are added on top, never less).
    await fillCheckout(page, { method: "cod" });
    expect(priceOf((await page.getByTestId("checkout-total").textContent()) ?? "")).toBeGreaterThanOrEqual(2 * dryPrice + rawPrice);
  });

  test("PIN-code delivery check uses the real shipping zones", async ({ page }) => {
    await page.goto(DRY);
    await page.fill("#pdp-pincode", "641664");
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByText(/we deliver to 641664/i)).toBeVisible();
    await page.fill("#pdp-pincode", "12");
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByText(/valid 6-digit PIN/i)).toBeVisible();
  });

  test("18. contact and newsletter forms work", async ({ page, browser }) => {
    const stamp = Date.now();
    await page.goto("/contact");
    await page.fill("#name", "Form Tester");
    await page.fill("#contact-email", "short");
    await page.fill("#message", `Hello from the test ${stamp}, about an order.`);
    await page.getByRole("button", { name: "Send message" }).click();
    // A mistake keeps what was typed.
    await expect(page.getByText(/valid email/i)).toBeVisible();
    await expect(page.locator("#message")).toHaveValue(`Hello from the test ${stamp}, about an order.`);
    await page.fill("#contact-email", `contact+${stamp}@example.com`);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(/received your message/i)).toBeVisible();

    await page.goto("/");
    const form = page.locator("form", { has: page.getByRole("button", { name: "Subscribe" }) }).first();
    await form.locator("input[type=email]").fill(`news+${stamp}@example.com`);
    await form.getByRole("button", { name: "Subscribe" }).click();
    await expect(page.getByText(/tick the box/i).first()).toBeVisible();
    await form.locator("input[name=consent]").check();
    await form.getByRole("button", { name: "Subscribe" }).click();
    await expect(page.getByText(/Thank you for subscribing/i)).toBeVisible();

    const admin = await loginAsAdmin(browser);
    const ap = await admin.newPage();
    await ap.goto("/admin/messages");
    await expect(ap.locator("body")).toContainText(`Hello from the test ${stamp}`);
    await ap.goto("/admin/marketing/subscribers");
    await expect(ap.locator("body")).toContainText(`news+${stamp}@example.com`);
    await admin.close();
  });

  test("19. scroll animations reveal content (and respect reduced motion)", async ({ page, browser }) => {
    await page.goto("/");
    const reveals = page.locator("[data-reveal]");
    expect(await reveals.count()).toBeGreaterThan(5);
    await scrollThrough(page);
    const hidden = await reveals.evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0 && Number(getComputedStyle(e).opacity) < 0.99).length);
    expect(hidden).toBe(0);
    // Hero text is visible straight away (CSS entrance, no JavaScript needed).
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const plain = await noJs.newPage();
    await plain.goto("/");
    await plain.waitForTimeout(1500);
    await expect(plain.getByRole("link", { name: /Shop Banana Chewy/i })).toBeVisible();
    await noJs.close();
    const calm = await browser.newContext({ reducedMotion: "reduce" });
    const quiet = await calm.newPage();
    await quiet.goto("/");
    const floating = await quiet.locator(".animate-float").first().evaluate((e) => getComputedStyle(e).animationName);
    expect(floating).toBe("none");
    await calm.close();
  });

  test("20 + 21. layouts fit and direct links / refresh work", async ({ page }) => {
    const errors = watchErrors(page);
    for (const path of ["/", "/shop", "/shop?collection=banana-chewy", DRY, RAW, "/cart", "/checkout", "/contact", "/faqs", "/about", "/track-order", "/login", "/register"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await noHorizontalScroll(page);
      await page.reload();
      await expect(page.locator("h1").first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test("22. no runtime errors on the main pages and SEO addresses are correct", async ({ page, request }) => {
    const errors = watchErrors(page);
    for (const path of ["/", "/shop", DRY, "/cart"]) {
      await page.goto(path);
      await page.waitForTimeout(500);
    }
    expect(errors).toEqual([]);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/products/banana-chewy-fresh-raw-banana");
    expect(sitemap).toContain("collection=banana-chewy");
    expect(sitemap).not.toContain("raw-front.webp");
    const health = await (await request.get("/api/health")).json();
    expect(health.database).toBe("ok");
  });
});

test.describe("brief scenarios — accounts", () => {
  test.skip(!mailpit, "Set E2E_MAILPIT_URL to run the email tests");

  test("7 + 8 + 10. create an account, stay signed in after refresh, log out and back in", async ({ page }) => {
    const email = `flow+${Date.now()}@example.com`;
    // A validation mistake keeps the name and email.
    await page.goto("/register");
    await page.fill("#full_name", "Priya Tester");
    await page.fill("#email", email);
    await page.fill("#password", "short");
    await page.fill("#confirm", "short");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    await expect(page.locator("#email")).toHaveValue(email);
    await expect(page.locator("#full_name")).toHaveValue("Priya Tester");

    await registerAndConfirm(page, email, "GoodPass123");
    await expect(page.locator("body")).toContainText("Priya");
    await page.reload();
    await expect(page).toHaveURL(/\/account/);
    await page.goto("/account/orders");
    await expect(page).toHaveURL(/\/account\/orders/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await page.goto("/account/addresses");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Faddresses/);
    await page.fill("#email", email);
    await page.fill("#password", "GoodPass123");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/\/account\/addresses/);
  });

  test("signing up again before confirming replaces the first password (no account takeover)", async ({ page }) => {
    const email = `takeover+${Date.now()}@example.com`;
    await page.goto("/register");
    await page.fill("#full_name", "Someone Else");
    await page.fill("#email", email);
    await page.fill("#password", "AttackerPass1");
    await page.fill("#confirm", "AttackerPass1");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/sent a confirmation link/i)).toBeVisible();
    await registerAndConfirm(page, email, "RealOwnerPass1", "Real Owner");
    await page.context().clearCookies();
    await signIn(page, email, "AttackerPass1");
    await expect(page.getByText(/Incorrect email or password/i)).toBeVisible();
    await signIn(page, email, "RealOwnerPass1");
    await page.waitForURL(/\/account/);
  });

  test("changing the password from the profile needs the current password", async ({ page }) => {
    const email = `change+${Date.now()}@example.com`;
    await registerAndConfirm(page, email, "FirstPass123");
    await page.goto("/account/profile");
    await page.fill("#current", "WrongPass999");
    await page.fill("#password", "SecondPass123");
    await page.fill("#confirm", "SecondPass123");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText(/isn't your current password/i)).toBeVisible();
    await page.fill("#current", "FirstPass123");
    await page.fill("#password", "SecondPass123");
    await page.fill("#confirm", "SecondPass123");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText(/password has been updated/i)).toBeVisible();
  });

  test("17. a review with a photo is submitted, moderated and then shown", async ({ page, browser }) => {
    const email = `review+${Date.now()}@example.com`;
    await registerAndConfirm(page, email, "ReviewPass123", "Review Tester");
    await page.goto(`${RAW}#reviews`);
    await page.getByRole("button", { name: "5 stars" }).click();
    await page.fill("#review-name", "Review T.");
    const body = `Lovely chewy texture, test ${Date.now()}.`;
    await page.fill("#review-body", body);
    // A real photo-like image (the server re-encodes it to WebP).
    const png = await samplePng();
    await page.locator("input[aria-label='Add photos']").setInputFiles({ name: "snack.png", mimeType: "image/png", buffer: png });
    await expect(page.getByRole("list", { name: "Your uploads" }).locator("input[name=media_id]")).toHaveCount(1);
    // A file that isn't really a video is refused.
    await page.locator("input[aria-label='Add a video']").setInputFiles({ name: "clip.mp4", mimeType: "video/mp4", buffer: Buffer.from("not a video at all") });
    await expect(page.getByText(/MP4, MOV or WebM/).last()).toBeVisible();
    await page.getByRole("button", { name: "Remove clip.mp4" }).click();
    await page.getByRole("button", { name: "Submit review" }).click();
    await expect(page.getByText(/appear once it has been checked/i)).toBeVisible();

    // Not public before approval.
    const anon = await browser.newContext();
    const visitor = await anon.newPage();
    await visitor.goto(RAW);
    await expect(visitor.locator("body")).not.toContainText(body);

    const admin = await loginAsAdmin(browser);
    const ap = await admin.newPage();
    await ap.goto("/admin/reviews?status=pending");
    const card = ap.locator("li", { hasText: body });
    await expect(card.getByRole("img", { name: /Photo attached by the customer/ })).toBeVisible();
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(ap.getByText(/Review approved/)).toBeVisible();
    await admin.close();

    await expect.poll(async () => {
      await visitor.goto(RAW);
      return (await visitor.locator("body").textContent())?.includes(body);
    }).toBe(true);
    const mine = visitor.locator("#reviews li", { hasText: body });
    await expect(mine.getByRole("list", { name: "Photos from this review" }).getByRole("button")).toHaveCount(1);
    await expect(mine.getByText("Verified purchase")).toHaveCount(0);
    await anon.close();
  });
});

test.describe("brief scenarios — admin", () => {
  test("14. orders appear in the admin dashboard", async ({ page, browser }) => {
    await addProductToCart(page);
    await fillCheckout(page, { method: "cod", email: `orders+${Date.now()}@example.com` });
    await page.getByRole("button", { name: /place order/i }).click();
    await page.waitForURL(/\/orders\/UNAR-\d+/);
    const orderNumber = /UNAR-\d+/.exec(page.url())![0];
    const admin = await loginAsAdmin(browser);
    const ap = await admin.newPage();
    await ap.goto("/admin");
    await expect(ap.getByText("Orders (all time)")).toBeVisible();
    await expect(ap.locator("body")).toContainText(orderNumber);
    await ap.goto("/admin/orders");
    await ap.getByRole("link", { name: orderNumber }).first().click();
    await expect(ap.locator("body")).toContainText("Test Customer");
    await admin.close();
  });

  test("15. stock changed in the dashboard shows publicly (Sold out and back)", async ({ browser, request }) => {
    const admin = await loginAsAdmin(browser);
    const page = await admin.newPage();
    await page.goto("/admin/inventory");
    const row = page.locator("tr", { hasText: "UNAR-BC-RAW-100" });
    const current = Number(/\d+/.exec((await row.locator("td").nth(2).textContent()) ?? "")?.[0] ?? "0");
    async function setStock(to: number, note: string) {
      await row.getByRole("button", { name: "Update stock" }).click();
      await page.locator('select[name="mode"]').selectOption("set");
      await page.locator('select[name="reason"]').selectOption("correction");
      await page.locator('input[name="quantity"]').fill(String(to));
      await page.locator('input[name="note"]').fill(note);
      await page.getByRole("button", { name: /^Save$/ }).click();
      await expect(page.getByText(/Stock for UNAR-BC-RAW-100 is now/).first()).toBeVisible();
    }
    expect(current).toBeGreaterThan(0);
    await setStock(0, "E2E sold out");
    await expect.poll(async () => (await (await request.get(RAW)).text()).includes("Sold out")).toBe(true);
    await setStock(current, "E2E restock");
    await expect.poll(async () => (await (await request.get(RAW)).text()).includes("In stock")).toBe(true);
    await admin.close();
  });

  test("16. admin can upload and reorder product images", async ({ browser }) => {
    const admin = await loginAsAdmin(browser);
    const page = await admin.newPage();
    page.on("dialog", (d) => d.accept());
    await page.goto("/admin/products");
    await page.getByRole("link", { name: /Fresh Raw Banana/i }).first().click();
    await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}/);
    const firstAlt = await page.inputValue("#img-alt-0");
    const secondAlt = await page.inputValue("#img-alt-1");

    // Reorder: move image 2 to the front, save, check the shop.
    await page.getByRole("button", { name: "Move image 2 up" }).click();
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText(/Saved/).first()).toBeVisible();
    const shop = await browser.newContext();
    const visitor = await shop.newPage();
    await visitor.goto(RAW);
    await expect(visitor.locator("[aria-live=polite]").first()).toContainText(`Image 1 of 5: ${secondAlt}`);

    // Upload a new image, describe it, save: the gallery gets a sixth photo.
    const png = await samplePng();
    await page.locator("input[aria-label='Upload product images']").setInputFiles({ name: "extra.png", mimeType: "image/png", buffer: png });
    await expect(page.locator("#img-alt-7")).toBeVisible();
    await page.fill("#img-alt-7", "E2E extra photo");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText(/Saved/).first()).toBeVisible();
    await visitor.reload();
    await expect(visitor.getByRole("group", { name: "Product images" }).getByRole("button")).toHaveCount(6);

    // Put everything back.
    await page.getByRole("button", { name: "Remove image 8" }).click();
    await page.getByRole("button", { name: "Move image 2 up" }).click();
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText(/Saved/).first()).toBeVisible();
    await visitor.reload();
    await expect(visitor.locator("[aria-live=polite]").first()).toContainText(`Image 1 of 5: ${firstAlt}`);
    await shop.close();
    await admin.close();
  });

  test("customers cannot open admin pages or admin data", async ({ page, request }) => {
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/login/);
    expect((await request.get("/admin/export/orders")).status()).toBe(403);
    expect((await request.post("/api/reviews/media", { multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } } })).status()).toBe(403);
  });
});

test.describe("brief scenarios — phone @mobile", () => {
  test("19 + 20 (phone). layout fits, gallery swipes and the buy bar follows @mobile", async ({ page }) => {
    const errors = watchErrors(page);
    for (const path of ["/", "/shop", RAW, "/contact"]) {
      await page.goto(path);
      await noHorizontalScroll(page);
    }
    await page.goto(RAW);
    const stage = page.locator("[aria-label='Product images']").locator("xpath=preceding-sibling::div").first();
    expect(stage).toBeTruthy();
    await page.getByRole("button", { name: "Next image" }).first().click();
    await expect(page.locator("[aria-live=polite]").first()).toContainText("Image 2 of 5");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
    await page.waitForTimeout(800);
    await expect(page.locator("div.fixed.bottom-0").getByRole("button", { name: /Add to cart: / })).toBeInViewport();
    await page.goto("/");
    await scrollThrough(page);
    const hidden = await page.locator("[data-reveal]").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0 && Number(getComputedStyle(e).opacity) < 0.99).length);
    expect(hidden).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe("phone layouts after sign-in @mobile", () => {
  test("account and dashboard pages fit the phone screen @mobile", async ({ page }) => {
    await signIn(page, process.env.E2E_ADMIN_EMAIL ?? "owner@unar.local", process.env.E2E_ADMIN_PASSWORD ?? "OwnerPass123");
    await page.waitForURL(/\/account/);
    const pages = [
      "/account",
      "/account/orders",
      "/account/addresses",
      "/account/profile",
      "/account/security",
      "/admin",
      "/admin/orders",
      "/admin/products",
      "/admin/products/new",
      "/admin/shipping",
      "/admin/inventory",
      "/admin/customers",
      "/admin/reviews",
      "/admin/marketing/coupons",
      "/admin/marketing/subscribers",
      "/admin/reports",
      "/admin/settings",
      "/admin/integrations",
    ];
    for (const path of pages) {
      await page.goto(path);
      const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(scroll, path).toBeLessThanOrEqual(inner + 1);
      expect(inner, `${path} (page zoomed out)`).toBeLessThanOrEqual(420);
    }
  });
});
