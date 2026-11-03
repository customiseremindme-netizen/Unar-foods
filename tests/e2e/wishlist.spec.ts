import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, resetRateLimits } from "./support/helpers";

const RAW_NAME = "UNAR Dehydrated Banana Chewy — Fresh Raw Banana";

test.describe("wishlist and quick view", () => {
  test.beforeEach(async () => {
    await resetRateLimits();
  });

  test("a guest saves a product, sees it on the wishlist, and it moves into their account on sign-in", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("button", { name: `Save ${RAW_NAME} to wishlist` }).click();
    await expect(page.getByText(/Saved to your wishlist/)).toBeVisible();
    await expect(page.getByRole("button", { name: `Remove ${RAW_NAME} from wishlist` })).toBeVisible();
    await expect(page.getByRole("link", { name: /Wishlist \(1 saved\)/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: `Remove ${RAW_NAME} from wishlist` })).toBeVisible();
    await page.goto("/wishlist");
    await expect(page.getByRole("heading", { name: RAW_NAME })).toBeVisible();

    await page.goto("/login");
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/\/account/);
    await page.goto("/wishlist");
    await expect(page.getByRole("heading", { name: RAW_NAME })).toBeVisible();
    // Remove it again (keeps the test account clean).
    await page.getByRole("button", { name: `Remove ${RAW_NAME} from wishlist` }).click();
    await expect(page.getByText(/Removed from your wishlist/)).toBeVisible();
    await page.reload();
    await expect(page.getByText("Nothing saved yet")).toBeVisible();
  });

  test("quick view shows the essentials and adds to cart without leaving the page", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("button", { name: `Quick view: ${RAW_NAME}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: RAW_NAME })).toBeVisible();
    await expect(dialog).toContainText("₹");
    await dialog.getByRole("button", { name: /Add to cart: / }).click();
    await expect(page.getByText("Your cart").first()).toBeVisible();
    await expect(page).toHaveURL(/\/shop/);
  });
});
