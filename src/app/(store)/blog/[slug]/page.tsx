import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCmsPage } from "@/lib/data/content";
import { getPublicSettings } from "@/lib/settings";
import { getSiteUrl } from "@/lib/env";
import { CmsPageView } from "@/components/content/cms-page";
import { JsonLd } from "@/lib/seo/jsonld";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getCmsPage("post", slug);
  if (!post) return { title: "Not found", robots: { index: false } };
  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", images: post.cover_image_url ? [{ url: post.cover_image_url }] : undefined },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, settings] = await Promise.all([getCmsPage("post", slug), getPublicSettings()]);
  if (!post) notFound();
  const site = getSiteUrl();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.excerpt ?? undefined,
          datePublished: post.published_at ?? undefined,
          dateModified: post.updated_at,
          author: post.author_name ? { "@type": "Person", name: post.author_name } : { "@type": "Organization", name: settings.store.name },
          publisher: { "@type": "Organization", name: settings.store.name },
          image: post.cover_image_url ? [post.cover_image_url.startsWith("http") ? post.cover_image_url : `${site}${post.cover_image_url}`] : undefined,
          mainEntityOfPage: `${site}/blog/${post.slug}`,
        }}
      />
      <CmsPageView
        page={post}
        eyebrow="Journal"
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Journal", href: "/blog" },
          { name: post.title, href: `/blog/${post.slug}` },
        ]}
      />
    </>
  );
}
