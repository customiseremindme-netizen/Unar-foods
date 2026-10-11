import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("homepage rendering records real browser performance and layout stability", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const metrics = { cls: 0, lcpMs: 0 };
    Object.assign(window, { unarPerformance: metrics });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!shift.hadRecentInput) metrics.cls += shift.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      metrics.lcpMs = entries.at(-1)?.startTime ?? metrics.lcpMs;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator(".home-hero img").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let top = 0; top < height; top += 700) {
    await page.evaluate((position) => window.scrollTo({ top: position, behavior: "instant" }), top);
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: testInfo.outputPath("homepage-desktop.png"), fullPage: true });
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const rendering = (window as Window & { unarPerformance?: { cls: number; lcpMs: number } }).unarPerformance;
    return { ...rendering, domContentLoadedMs: navigation.domContentLoadedEventEnd, transferredBytes: performance.getEntriesByType("resource").reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).transferSize, 0) };
  });
  const metricsPath = testInfo.outputPath("homepage-browser-performance.json");
  await writeFile(metricsPath, JSON.stringify({ ...metrics, context: "Isolated CI Chrome at 1366 × 900, local test server after a full-page scroll; not a public Lighthouse or real-user score." }, null, 2));
  await testInfo.attach("homepage-browser-performance.json", { path: metricsPath, contentType: "application/json" });
  console.log(`UNAR browser metrics: ${JSON.stringify(metrics)}`);
  expect(metrics.cls ?? 0).toBeLessThan(0.25);
  expect(consoleErrors).toEqual([]);
});
