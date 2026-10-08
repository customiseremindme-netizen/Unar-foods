import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCmsPage } from "@/lib/data/content";
import { CmsPageView } from "@/components/content/cms-page";
import { ButtonLink } from "@/components/ui/button";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("page", "about");
  return {
    title: page?.seo_title || page?.title || "Our Story",
    description: page?.seo_description || page?.excerpt || undefined,
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const page = await getCmsPage("page", "about");
  if (!page) notFound();
  return (
    <CmsPageView
      page={page}
      eyebrow="Our Story"
      crumbs={[{ name: "Home", href: "/" }, { name: page.title, href: "/about" }]}
      after={
        <div className="mt-14 flex flex-wrap gap-3">
          <ButtonLink href="/shop">Shop Banana Chewy</ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Get in touch
          </ButtonLink>
        </div>
      }
    />
  );
}
