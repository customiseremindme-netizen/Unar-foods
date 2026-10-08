import type { MetadataRoute } from "next";
import { getPublicSettings } from "@/lib/settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { store, seo, theme } = await getPublicSettings();
  return {
    name: seo.site_title,
    short_name: store.name,
    description: seo.description,
    start_url: "/",
    display: "standalone",
    background_color: theme.cream,
    theme_color: theme.forest,
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
