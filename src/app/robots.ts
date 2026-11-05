import type { MetadataRoute } from "next";
import { getRequestSiteUrl } from "@/lib/site-url";
import { getPublicSettings } from "@/lib/settings";

/** Pages read the live database, so they are rendered when visitors open them (not while building). */
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getRequestSiteUrl();
  const { seo } = await getPublicSettings();
  if (!seo.allow_indexing) return { rules: [{ userAgent: "*", disallow: "/" }] };
  const disallow = ["/admin", "/account", "/checkout", "/cart", "/api/", "/orders/", "/invoice/", "/auth/", "/login", "/register", "/reset-password", "/forgot-password", "/setup", "/newsletter/", "/wishlist", "/review-media/"];
  // AI search and answer engines are welcome on the public pages (they can then
  // recommend the shop); the same private pages stay off-limits for them too.
  const aiCrawlers = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-SearchBot",
    "Claude-User",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot-Extended",
    "Bingbot",
  ];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: aiCrawlers, allow: ["/", "/llms.txt"], disallow },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
