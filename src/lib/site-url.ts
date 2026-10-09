import "server-only";
import { headers } from "next/headers";
import { getConfiguredSiteUrl, getSiteUrl } from "@/lib/env";

/**
 * The website address to put in emails and login links.
 *
 * Uses NEXT_PUBLIC_SITE_URL when it is set (always set it once your own
 * domain is connected). Until then it uses the address the visitor is
 * actually on — useful while the hosting company gives the site a
 * temporary address that changes.
 */
export async function getRequestSiteUrl(): Promise<string> {
  const configured = getConfiguredSiteUrl();
  if (configured) return configured;
  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim();
    if (host && /^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) {
      const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
      const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0]!.trim();
      return `${proto === "http" || (local && proto !== "https") ? "http" : "https"}://${host}`;
    }
  } catch {
    // Not inside a web request (e.g. at build time).
  }
  return getSiteUrl();
}
