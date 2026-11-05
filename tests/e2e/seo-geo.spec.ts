import { expect, test } from "@playwright/test";
import { PRODUCT_PATH } from "./support/helpers";

/** Search engines (SEO) and AI assistants (GEO) get accurate, machine-readable facts. */
test.describe("SEO and GEO", () => {
  test("llms.txt summarises the shop from live data", async ({ request }) => {
    const res = await request.get("/llms.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");
    const text = await res.text();
    expect(text).toMatch(/^# UNAR/);
    expect(text).toContain("UNAR Dehydrated Banana Chewy — With Dry Fruits & Seeds");
    expect(text).toMatch(/Price: ₹\d+/);
    expect(text).toContain("Ingredients (as printed on the pack)");
    expect(text).toContain("/products/banana-chewy-fresh-raw-banana");
  });

  test("robots.txt welcomes AI search crawlers but keeps private pages closed", async ({ request }) => {
    const text = await (await request.get("/robots.txt")).text();
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) expect(text).toContain(`User-Agent: ${bot}`);
    expect(text).toContain("Disallow: /admin");
    expect(text).toContain("Disallow: /checkout");
    expect(text).toMatch(/Sitemap: .*\/sitemap\.xml/);
  });

  test("product pages carry pack facts; About and Contact say what they are", async ({ request }) => {
    const product = await (await request.get(PRODUCT_PATH)).text();
    expect(product).toContain('"name":"Ingredients"');
    expect(product).toContain('"priceCurrency":"INR"');
    expect(product).toContain('<html lang="en-IN"');
    expect(await (await request.get("/about")).text()).toContain('"@type":"AboutPage"');
    const contact = await (await request.get("/contact")).text();
    expect(contact).toContain('"@type":"ContactPage"');
    expect(contact).toContain('"@type":"OnlineStore"');
  });

  test("security headers are sent", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("'strict-dynamic'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
    expect(h["strict-transport-security"]).toContain("max-age=");
  });
});
