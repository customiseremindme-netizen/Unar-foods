import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { addProductToCart, fillCheckout, loginAsAdmin, resetRateLimits } from "./support/helpers";

/** Runs SQL against the LOCAL test database (demo data only). */
async function sql(query: string, params: unknown[] = []) {
  if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
  const mysql = await import("mysql2/promise");
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  try {
    return await db.query(query, params);
  } finally {
    await db.end();
  }
}

test.describe("products admin (Shopify-style)", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test("add a product on one page, find it, update its stock, then archive and delete it from the list", async ({ browser }) => {
    const admin = await loginAsAdmin(browser);
    const page = await admin.newPage();
    page.on("dialog", (d) => d.accept());
    const name = `Test Pouch ${Date.now()}`;

    await page.goto("/admin/products");
    await page.getByRole("link", { name: "Add product" }).click();
    await page.waitForURL(/\/admin\/products\/new/);
    // Publishing needs a photo and a price.
    await page.fill("#np-title", name);
    await page.getByRole("button", { name: "Save & publish" }).click();
    await expect(page.getByText("Enter the selling price, e.g. 149")).toBeVisible();
    await expect(page.getByText(/Add at least one photo to publish/)).toBeVisible();

    await page.fill("#np-price", "99");
    await page.fill("#np-mrp", "120");
    await page.fill("#np-stock", "7");
    await page.locator('input[type=file][aria-label="Upload product photos"]').setInputFiles("public/images/products/nuts-front.webp");
    await expect(page.getByRole("button", { name: "Remove photo 1" })).toBeVisible();
    await page.getByRole("button", { name: "Save & publish" }).click();
    await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}$/);
    await expect(page.getByText("In stock: 7").first()).toBeVisible();

    // Stock can be changed right on the product page.
    await page.getByRole("button", { name: "Update stock" }).first().click();
    await page.locator('select[name="mode"]').selectOption("add");
    await page.locator('input[name="quantity"]').fill("3");
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect(page.getByText("In stock: 10").first()).toBeVisible();

    // Advanced fields are tucked away under "More details".
    await expect(page.locator("#ingredients")).toBeHidden();
    await page.getByText("More details").click();
    await expect(page.locator("#ingredients")).toBeVisible();

    // List: search, tick, archive, then delete.
    await page.goto("/admin/products");
    await page.getByPlaceholder("Search by name or SKU").fill(name);
    await expect(page.getByRole("checkbox", { name: `Select ${name}` })).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr")).toContainText("10 in stock");
    await page.getByRole("checkbox", { name: `Select ${name}` }).check();
    await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(/Archive or unpublish the product before deleting it/).first()).toBeVisible();
    await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("1 product archived.").first()).toBeVisible();
    await page.getByRole("checkbox", { name: `Select ${name}` }).check();
    await page.getByRole("group", { name: "Bulk actions" }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("1 product deleted.").first()).toBeVisible();
    await expect(page.getByText(`No products match “${name}”.`)).toBeVisible();
    await admin.close();
  });

  test("checkout says why delivery is free, and how much more is needed for free delivery", async ({ page }) => {
    const code = `FREESHIP${Date.now() % 100000}`;
    await sql("INSERT INTO coupons (id, code, discount_type, discount_value, is_active) VALUES (UUID(), ?, 'free_shipping', 0, 1)", [code]);
    await addProductToCart(page);
    await fillCheckout(page, { method: "cod" });
    // Demo zone: ₹60, free above ₹499; one pack is ₹149 or less.
    await expect(page.getByText(/Add ₹[\d,]+ more for free delivery/)).toBeVisible();
    await expect(page.locator("dd", { hasText: "₹60" })).toBeVisible();
    await page.getByPlaceholder("Coupon code").fill(code);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(`Free (coupon ${code})`)).toBeVisible();
  });

  test("the Shipping page warns when Cash on Delivery is off for the whole shop and switches it on in one click", async ({ browser }) => {
    await sql("UPDATE settings SET value = JSON_SET(value, '$.cod_enabled', false) WHERE `key` = 'checkout'");
    try {
      const admin = await loginAsAdmin(browser);
      const page = await admin.newPage();
      await page.goto("/admin/shipping");
      await expect(page.getByText("Cash on Delivery is switched off for the whole shop")).toBeVisible();
      await page.getByRole("button", { name: "Switch on Cash on Delivery" }).click();
      await expect(page.getByText("Cash on Delivery is now on.").first()).toBeVisible();
      await expect(page.getByText("Cash on Delivery is switched off for the whole shop")).toHaveCount(0);
      await admin.close();
    } finally {
      await sql("UPDATE settings SET value = JSON_SET(value, '$.cod_enabled', true) WHERE `key` = 'checkout'");
    }
  });
});
