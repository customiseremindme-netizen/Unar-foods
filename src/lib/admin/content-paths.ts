/** Where a CMS page appears on the public website. */
export function publicPathFor(kind: string, slug: string): string {
  if (kind === "policy") return `/policies/${slug}`;
  if (kind === "post") return `/blog/${slug}`;
  if (slug === "about") return "/about";
  return `/pages/${slug}`;
}

export const KIND_LABELS: Record<string, string> = { page: "Page", policy: "Policy", post: "Journal post" };
