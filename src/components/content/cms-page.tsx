import Image from "next/image";
import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import type { CmsPage } from "@/lib/data/content";
import { Markdown } from "@/components/ui/markdown";
import { Breadcrumbs, type Crumb } from "@/components/ui/misc";
import { LeafSprig } from "@/components/brand/botanical";
import { formatDate } from "@/lib/utils";

export function OwnerReviewNotice() {
  return (
    <div role="note" className="flex gap-3 rounded-2xl border border-banana/50 bg-banana-soft/60 px-5 py-4 text-[0.88rem] text-forest-deep">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <strong>OWNER REVIEW REQUIRED.</strong> This policy is a template that has not yet been reviewed and approved by the
        business owner, and it has not been reviewed by a lawyer.
      </p>
    </div>
  );
}

export function CmsPageView({ page, crumbs, eyebrow, after }: { page: CmsPage; crumbs: Crumb[]; eyebrow?: string; after?: ReactNode }) {
  return (
    <article>
      <header className="paper relative overflow-hidden border-b border-line">
        <LeafSprig className="absolute -right-2 top-4 hidden h-48 w-32 text-sage sm:block" />
        <div className="container-site relative max-w-4xl py-12 lg:py-16">
          <Breadcrumbs items={crumbs} />
          {eyebrow ? <p className="eyebrow mt-6">{eyebrow}</p> : null}
          <h1 className="mt-4 text-[2.4rem] sm:text-[3.2rem]">{page.title}</h1>
          {page.excerpt ? <p className="mt-4 max-w-2xl text-[1.05rem] text-muted">{page.excerpt}</p> : null}
          {page.kind !== "page" ? (
            <p className="mt-4 text-[0.82rem] text-muted">
              {page.kind === "post" && page.author_name ? `${page.author_name} · ` : ""}
              {page.kind === "post" ? formatDate(page.published_at) : `Last updated ${formatDate(page.updated_at)}`}
            </p>
          ) : null}
        </div>
      </header>
      <div className="container-site max-w-4xl py-12 lg:py-16">
        {page.requires_owner_review ? (
          <div className="mb-10">
            <OwnerReviewNotice />
          </div>
        ) : null}
        {page.cover_image_url ? (
          <div className="relative mb-12 aspect-[16/9] overflow-hidden rounded-[2rem] bg-cream-deep">
            <Image src={page.cover_image_url} alt={page.cover_image_alt ?? ""} fill sizes="(min-width: 1024px) 896px, 100vw" className="object-cover" priority />
          </div>
        ) : null}
        <Markdown className="max-w-3xl">{page.body_md}</Markdown>
        {after}
      </div>
    </article>
  );
}
