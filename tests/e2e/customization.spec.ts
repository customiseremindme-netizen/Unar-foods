import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from "./support/helpers";

test("appearance settings persist and customize the real storefront", async ({ browser, page: storefront }) => {
  const admin = await loginAsAdmin(browser);
  const editor = await admin.newPage();
  try {
    await editor.goto("/admin/customize");
    const form = editor.locator("#set-appearance");
    const heading = `Our Banana Collection ${Date.now()}`;
    await editor.selectOption("#appearance-heading_font", "georgia");
    await editor.selectOption("#appearance-body_font", "system");
    await editor.selectOption("#appearance-content_width", "wide");
    await editor.selectOption("#appearance-button_style", "soft");
    await editor.locator("#appearance-sticky_header").uncheck();
    await editor.locator("#appearance-animations_enabled").uncheck();
    await editor.fill("#appearance-shop_columns", "4");
    await editor.fill("#appearance-shop_heading", heading);
    await editor.fill("#appearance-shop_description", "Choose your favourite UNAR banana snack.");
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor.getByText("Settings saved.").first()).toBeVisible();
    await editor.reload();
    await expect(editor.locator("#appearance-shop_heading")).toHaveValue(heading);
    await expect(editor.locator("#appearance-animations_enabled")).not.toBeChecked();
    await storefront.goto("/shop");
    const title = storefront.getByRole("heading", { name: heading, exact: true });
    await expect(title).toBeVisible();
    await expect(storefront.getByText("Choose your favourite UNAR banana snack.")).toBeVisible();
    expect(await title.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Georgia");
    expect(await storefront.locator(".unar-store").evaluate((el) => getComputedStyle(el).getPropertyValue("--site-max-width").trim())).toBe("96rem");
    expect(await storefront.locator(".shop-product-grid").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(4);
    expect(await storefront.locator("header").evaluate((el) => getComputedStyle(el).position)).toBe("relative");
    await storefront.goto("/");
    await expect(storefront.locator("[data-reveal]").first()).toBeVisible();
    expect(await storefront.locator("[data-reveal]").first().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  } finally {
    await editor.goto("/admin/customize");
    const form = editor.locator("#set-appearance");
    await form.getByRole("button", { name: "Load brand defaults", exact: true }).click();
    const save = form.getByRole("button", { name: "Save", exact: true });
    if (await save.isEnabled()) {
      await save.click();
      await expect(editor.getByText("Settings saved.").first()).toBeVisible();
    }
    await admin.close();
  }
});

test("@mobile customization tools and forms fit the phone screen", async ({ page }) => {
  await page.goto("/login?next=/admin/customize");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/admin\/customize/);
  await expect(page.getByRole("heading", { name: "Customize website", exact: true })).toBeVisible();
  await page.getByLabel("Find a customization tool").fill("Menus");
  await expect(page.getByRole("region", { name: "Customization tools" }).getByRole("link")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /Menus & footer/ })).toBeVisible();
  await page.locator("#appearance-shop_heading").scrollIntoViewIfNeeded();
  await expect(page.locator("#appearance-shop_heading")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("section duplication and presentation save as a draft and publish safely", async ({ browser, page: storefront }) => {
  const admin = await loginAsAdmin(browser);
  const editor = await admin.newPage();
  editor.on("dialog", (dialog) => dialog.accept());
  try {
    await editor.goto("/admin/content");
    await editor.getByRole("button", { name: /^1\. Hero banner/ }).click();
    const background = editor.getByLabel("Background", { exact: true });
    const spacing = editor.getByLabel("Section spacing", { exact: true });
    await background.selectOption("sage");
    await spacing.selectOption("compact");
    await editor.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(editor.getByText(/Draft saved/)).toBeVisible();
    await storefront.goto("/");
    await expect(storefront.locator(".home-section").first()).toHaveAttribute("data-background", "original");
    await editor.reload();
    await editor.getByRole("button", { name: /^1\. Hero banner/ }).click();
    await expect(editor.getByLabel("Background", { exact: true })).toHaveValue("sage");
    await editor.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(editor.getByText(/Homepage published/)).toBeVisible();
    await storefront.reload();
    await expect(storefront.locator(".home-section").first()).toHaveAttribute("data-background", "sage");
    await expect(storefront.locator(".home-section").first()).toHaveAttribute("data-spacing", "compact");
    await editor.getByRole("button", { name: "Duplicate Hero banner", exact: true }).click();
    await expect(editor.getByRole("button", { name: "Duplicate Hero banner", exact: true })).toHaveCount(2);
    await editor.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(editor.getByText(/Draft saved/)).toBeVisible();
    await storefront.reload();
    await expect(storefront.locator(".home-section > section[aria-labelledby] h1")).toHaveCount(1);
    await editor.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(editor.getByText(/Homepage published/)).toBeVisible();
    await storefront.reload();
    const heroHeadings = storefront.locator(".home-section > section[aria-labelledby] h1");
    await expect(heroHeadings).toHaveCount(2);
    const ids = await heroHeadings.evaluateAll((els) => els.map((el) => el.id));
    expect(new Set(ids).size).toBe(2);
    await editor.getByRole("button", { name: "Remove Hero banner", exact: true }).last().click();
    await editor.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(editor.getByText(/Homepage published/)).toBeVisible();
    await editor.getByRole("button", { name: "Discard draft", exact: true }).click();
    await expect(editor.getByRole("button", { name: "Duplicate Hero banner", exact: true })).toHaveCount(1);
    await editor.getByRole("button", { name: /^1\. Hero banner/ }).click();
    await editor.getByLabel("Background", { exact: true }).selectOption("original");
    await editor.getByLabel("Section spacing", { exact: true }).selectOption("standard");
    await editor.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(editor.getByText(/Homepage published/)).toBeVisible();
    await storefront.reload();
    await expect(storefront.locator(".home-section").first()).toHaveAttribute("data-background", "original");
  } finally { await admin.close(); }
});
