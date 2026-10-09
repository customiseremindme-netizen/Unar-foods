import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCmsPage } from "@/lib/data/content";
import { CmsPageView } from "@/components/content/cms-page";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCmsPage("policy", slug);
  if (!page) return { title: "Not found", robots: { index: false } };
  return {
    title: page.seo_title || page.title,
    description: page.seo_description || page.excerpt || undefined,
    alternates: { canonical: `/policies/${page.slug}` },
  };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getCmsPage("policy", slug);
  if (!page) notFound();
  return <CmsPageView page={page} eyebrow="Policies" crumbs={[{ name: "Home", href: "/" }, { name: page.title, href: `/policies/${page.slug}` }]} />;
}
