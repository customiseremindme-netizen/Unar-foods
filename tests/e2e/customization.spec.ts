import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./support/helpers";

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
