import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";
import { getPublishedProducts } from "@/lib/data/catalog";
import { listCmsPages } from "@/lib/data/content";

/** Pages read the live database, so they are rendered when visitors open them (not while building). */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const [products, policies, posts, pages] = await Promise.all([
    getPublishedProducts(),
    listCmsPages("policy"),
    listCmsPages("post"),
    listCmsPages("page"),
  ]);
  const staticRoutes = ["", "/shop", "/about", "/faqs", "/contact", "/blog", "/track-order"].map((path) => ({
    url: `${site}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
  return [
    ...staticRoutes,
    ...products.map((p) => ({
      url: `${site}/products/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.9,
      images: p.images.slice(0, 3).map((i) => (i.url.startsWith("http") ? i.url : `${site}${i.url}`)),
    })),
    ...posts.map((p) => ({ url: `${site}/blog/${p.slug}`, lastModified: p.updated_at, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...policies.map((p) => ({ url: `${site}/policies/${p.slug}`, lastModified: p.updated_at, changeFrequency: "yearly" as const, priority: 0.3 })),
    ...pages
      .filter((p) => p.slug !== "about")
      .map((p) => ({ url: `${site}/pages/${p.slug}`, lastModified: p.updated_at, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
