import type { Metadata } from "next";
import { getFaqs } from "@/lib/data/content";
import { FaqList } from "@/components/home/sections";
import { Breadcrumbs, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { LeafSprig } from "@/components/brand/botanical";
import { JsonLd } from "@/lib/seo/jsonld";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "FAQs",
  description: "Answers to common questions about UNAR Banana Chewy, ingredients, allergens, orders and delivery.",
  alternates: { canonical: "/faqs" },
};

function stripMarkdown(md: string) {
  return md.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`>#]/g, "").trim();
}

export default async function FaqsPage() {
  const faqs = await getFaqs();
  const categories = [...new Set(faqs.map((f) => f.category))];
  return (
    <>
      {faqs.length > 0 ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: stripMarkdown(f.answer_md) },
            })),
          }}
        />
      ) : null}
      <header className="paper relative overflow-hidden border-b border-line">
        <LeafSprig className="absolute -right-2 top-4 hidden h-48 w-32 text-sage sm:block" />
        <div className="container-site relative max-w-4xl py-12 lg:py-16">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "FAQs", href: "/faqs" }]} />
          <h1 className="mt-6 text-[2.4rem] sm:text-[3.2rem]">Frequently asked questions</h1>
          <p className="mt-4 max-w-2xl text-muted">Can&apos;t find what you&apos;re looking for? We&apos;re happy to help.</p>
        </div>
      </header>
      <div className="container-site max-w-4xl py-12 lg:py-16">
        {faqs.length === 0 ? (
          <EmptyState title="No FAQs yet" description="Questions and answers will appear here soon." />
        ) : (
          <div className="space-y-14">
            {categories.map((category) => (
              <section key={category} aria-labelledby={`faq-${category}`}>
                <h2 id={`faq-${category}`} className="mb-4 text-[1.6rem]">
                  {category}
                </h2>
                <FaqList faqs={faqs.filter((f) => f.category === category)} />
              </section>
            ))}
          </div>
        )}
        <div className="mt-16 rounded-[2rem] bg-sage-soft p-8 text-center">
          <p className="font-display text-[1.6rem] text-forest">Still have a question?</p>
          <ButtonLink href="/contact" className="mt-5">
            Contact us
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
