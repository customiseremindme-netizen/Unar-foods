import { getPublicSettings } from "@/lib/settings";
import { getRequestSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** Tells security researchers how to report a problem (RFC 9116). */
export async function GET() {
  const { store } = await getPublicSettings();
  const site = await getRequestSiteUrl();
  const expires = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
  const lines = [
    ...(store.email ? [`Contact: mailto:${store.email}`] : []),
    `Contact: ${site}/contact`,
    `Expires: ${expires}`,
    "Preferred-Languages: en, ta",
    `Canonical: ${site}/.well-known/security.txt`,
  ];
  return new Response(lines.join("\n") + "\n", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
