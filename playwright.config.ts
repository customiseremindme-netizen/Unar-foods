import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. They run against a site that is ALREADY running
 * (default http://localhost:3000) with the local Supabase database and the
 * mock Razorpay server. See tests/README.md for the one-time setup.
 *
 * Never point these tests at the live shop: they place orders.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : undefined,
  },
  webServer: {
    command: "node tests/e2e/support/mock-razorpay.mjs",
    url: "http://127.0.0.1:4010/__state",
    reuseExistingServer: true,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
});
