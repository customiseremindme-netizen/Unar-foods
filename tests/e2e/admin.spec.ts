import path from "node:path";
import { expect, test } from "@playwright/test";
import { addProductToCart, fillCheckout, loginAsAdmin, PRODUCT_PATH, stubRazorpayCheckout } from "./support/helpers";

test.describe("admin dashboard", () => {
  test("price change in the dashboard appears on the product page", async ({ browser, request }) => {
    const admin = await loginAsAdmin(browser);
    const page = await admin.newPage();
    page.on("dialog", (d) => d.accept());
    await page.goto("/admin/products");
    await page.getByRole("link", { name: /Dry Fruits/i }).first().click();
    await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}/);
    const original = await page.inputValue("#v-price-0");
    const changed = String(Number(original) - 1);
    await page.fill("#v-price-0", changed);
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText(/Saved/).first()).toBeVisible();
    await expect.poll(async () => (await (await request.get(PRODUCT_PATH)).text()).includes(`₹${changed}`)).toBe(true);
    await page.fill("#v-price-0", original);
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText(/Saved/).first()).toBeVisible();
    await admin.close();
  });

  test("stock can be adjusted and is logged", async ({ browser }) => {
    const admin = await loginAsAdmin(browser);
    const page = await admin.newPage();
    await page.goto("/admin/inventory");
    await page.getByRole("button", { name: "Update stock" }).first().click();
    await page.locator('input[name="quantity"]').fill("2");
    await page.locator('input[name="note"]').fill("E2E restock");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await expect(page.getByText(/Stock for .* is now/).first()).toBeVisible();
    await page.reload();
    await expect(page.locator("#history")).toContainText("E2E restock");
    await admin.close();
  });

  test("a coupon created in the dashboard discounts the order", async ({ browser }) => {
    const code = `E2E${Date.now().toString().slice(-6)}`;
    const admin = await loginAsAdmin(browser);
    const page = await admin.newPage();
    await page.goto("/admin/marketing/coupons");
    await page.getByRole("button", { name: "Create a coupon" }).click();
    await page.locator("#new-code").fill(code);
    await page.locator("#new-val").fill("10");
    await page.getByRole("button", { name: "Create coupon" }).click();
    await expect(page.getByText(`Coupon ${code} saved.`)).toBeVisible();
    await admin.close();

    const shopper = await browser.newContext();
    await stubRazorpayCheckout(shopper);
    const sp = await shopper.newPage();
    await addProductToCart(sp);
    await fillCheckout(sp, { method: "cod" });
    await expect(sp.locator("body")).toContainText("Shipping");
    await sp.getByPlaceholder("Coupon code").fill(code);
    await sp.getByRole("button", { name: "Apply" }).click();
    // 10% of the ₹149 pack, calculated by the server.
    await expect(sp.locator("body")).toContainText(`Discount (${code})`);
    await expect(sp.locator("body")).toContainText("₹14.90");
    await shopper.close();
  });

  test("homepage edits stay in draft until published", async ({ browser, request }) => {
    const admin = await loginAsAdmin(browser);
    const page = await admin.newPage();
    page.on("dialog", (d) => d.accept());
    await page.goto("/admin/content");
    await page.getByRole("button", { name: /^1\. Hero banner/ }).click();
    const headline = page.locator('input[id$="-headline"]').first();
    const original = await headline.inputValue();
    const marker = `E2E-${Date.now()}`;
    await headline.fill(`${original} ${marker}`);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Draft saved/)).toBeVisible();
    expect(await (await request.get("/")).text()).not.toContain(marker);
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page.waitForLoadState("load");
    await admin.close();
  });

  test("order can be marked shipped with tracking", async ({ browser }) => {
    const shopper = await browser.newContext();
    const sp = await shopper.newPage();
    await addProductToCart(sp);
    await fillCheckout(sp, { method: "cod" });
    await sp.getByRole("button", { name: /Place order/i }).click();
    await sp.waitForURL(/\/orders\/UNAR-\d+/);
    const orderNumber = sp.url().match(/UNAR-\d+/)![0];
    await shopper.close();

    const admin = await loginAsAdmin(browser);
    const page = await admin.newPage();
    await page.goto(`/admin/orders?q=${orderNumber}`);
    await page.getByRole("link", { name: orderNumber }).click();
    await page.getByRole("button", { name: "Add tracking manually" }).click();
    await page.fill("#carrier-new", "India Post");
    await page.fill("#awb-new", "EM000000001IN");
    await page.getByRole("button", { name: "Add shipment" }).click();
    await expect(page.locator("main")).toContainText("EM000000001IN");
    await page.getByRole("button", { name: "Mark shipped" }).first().click();
    await expect(page.locator("main")).toContainText(/Shipped/i);
    await admin.close();
  });
});


test("admin photo upload, reordering and removal update the storefront", async ({ browser, page: storefront }) => {
  const admin = await loginAsAdmin(browser);
  const editor = await admin.newPage();
  try {
    await editor.goto("/admin/products");
    await editor.getByRole("link", { name: /Dry Fruits/i }).first().click();
    await editor.waitForURL(/\/admin\/products\/[0-9a-f-]{36}/);
    await expect(editor.locator("#section-images")).toBeVisible();
    const rows = editor.locator("#section-images ol > li");
    const originalCount = await rows.count();
    await editor.getByLabel("Upload product images").setInputFiles(path.resolve("public/images/products/dry-fruits-seeds/01-main-hero-pouch.webp"));
    await expect(rows).toHaveCount(originalCount + 1);
    await editor.locator(`#img-alt-${originalCount}`).fill("Gallery upload QA");
    for (let n = originalCount + 1; n > 1; n--) await editor.getByRole("button", { name: `Move image ${n} up`, exact: true }).click();
    await editor.getByRole("button", { name: /^Save$/ }).click();
    await expect(editor.getByText(/Saved/).first()).toBeVisible();
    await storefront.goto(PRODUCT_PATH);
    const photo = storefront.getByRole("button", { name: "Open image viewer: Gallery upload QA", exact: true }).locator("img");
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await editor.getByRole("button", { name: "Remove image 1", exact: true }).click();
    await editor.getByRole("button", { name: /^Save$/ }).click();
    await expect(editor.getByText(/Saved/).first()).toBeVisible();
    await storefront.reload();
    await expect(storefront.getByRole("button", { name: "Open image viewer: Gallery upload QA", exact: true })).toHaveCount(0);
    await expect(storefront.getByRole("list", { name: "Product images" }).getByRole("button")).toHaveCount(5);
  } finally { await admin.close(); }
});
