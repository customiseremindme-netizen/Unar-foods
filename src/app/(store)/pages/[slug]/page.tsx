import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getCmsPage } from "@/lib/data/content";
import { CmsPageView } from "@/components/content/cms-page";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCmsPage("page", slug);
  if (!page) return { title: "Not found", robots: { index: false } };
  return { title: page.seo_title || page.title, description: page.seo_description || page.excerpt || undefined, alternates: { canonical: `/pages/${slug}` } };
}

/** Extra pages the owner creates in the content manager. */
export default async function CustomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "about") permanentRedirect("/about");
  const page = await getCmsPage("page", slug);
  if (!page) notFound();
  return <CmsPageView page={page} crumbs={[{ name: "Home", href: "/" }, { name: page.title, href: `/pages/${slug}` }]} />;
}
