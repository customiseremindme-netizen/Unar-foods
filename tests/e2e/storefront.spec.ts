import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PRODUCT_PATH } from "./support/helpers";

test.describe("storefront", () => {
  test("homepage shows the brand, tagline and products", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /UNAR/i }).first()).toBeVisible();
    await expect(page.locator("body")).toContainText("One Healthy Habit a Day");
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("shop lists both Banana Chewy products", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("link", { name: /Dry Fruits/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Raw Banana/i }).first()).toBeVisible();
  });

  test("product page shows price, label details and structured data", async ({ page }) => {
    await page.goto(PRODUCT_PATH);
    await expect(page.locator("h1")).toContainText("Banana Chewy");
    await expect(page.getByRole("button", { name: /Add to cart/i }).first()).toBeVisible();
    await expect(page.locator("body")).toContainText("₹");
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.join(" ")).toContain('"@type":"Product"');
    // No invented ratings: aggregateRating only appears when real approved reviews exist.
    expect(jsonLd.join(" ")).not.toContain("aggregateRating");
  });

  test("policy pages are clearly marked for owner review", async ({ page }) => {
    await page.goto("/policies/refund-policy");
    await expect(page.locator("body")).toContainText(/owner review/i);
  });

  test("unknown pages return 404", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
  });

  test("SEO files are available", async ({ request }) => {
    expect((await request.get("/sitemap.xml")).status()).toBe(200);
    expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /admin");
  });

  for (const path of ["/", "/shop", PRODUCT_PATH, "/checkout", "/contact"]) {
    test(`no serious accessibility problems on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(800);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
    });
  }
});

test.describe("mobile @mobile", () => {
  test("menu opens and navigates @mobile", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /menu/i }).first().click();
    await page.getByRole("dialog").getByRole("link", { name: "Shop" }).click();
    await expect(page).toHaveURL(/\/shop/);
  });

  test("product can be added to cart on a phone @mobile", async ({ page }) => {
    await page.goto(PRODUCT_PATH);
    await page.getByRole("button", { name: /Add to cart: /i }).first().click();
    await expect(page.getByRole("dialog").getByText("Your cart")).toBeVisible();
  });
});

test.describe("product photography", () => {
  for (const slug of ["banana-chewy-dry-fruits-seeds", "banana-chewy-fresh-raw-banana"]) {
    test(`all five photos load for ${slug}`, async ({ page }) => {
      await page.goto(`/products/${slug}`);
      const thumbs = page.getByRole("list", { name: "Product images" }).getByRole("button");
      await expect(thumbs).toHaveCount(5);
      for (let i = 0; i < 5; i++) {
        await thumbs.nth(i).click();
        await expect(thumbs.nth(i)).toHaveAttribute("aria-current", "true");
        const photo = page.getByRole("button", { name: /open image viewer/i }).locator("img");
        await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      }
      await page.getByRole("button", { name: /open image viewer/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("dialog")).toContainText("1 / 5");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    });
  }
});
