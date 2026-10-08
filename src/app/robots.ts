import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";
import { getPublicSettings } from "@/lib/settings";

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = getSiteUrl();
  const { seo } = await getPublicSettings();
  if (!seo.allow_indexing) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/account", "/checkout", "/cart", "/api/", "/orders/", "/invoice/", "/auth/", "/login", "/register", "/reset-password", "/newsletter/"],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
