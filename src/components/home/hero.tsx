"use client";

import Image from "next/image";
import { m } from "motion/react";
import { Leaf } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { BananaLeaf, LeafSprig } from "@/components/brand/botanical";
import { Parallax } from "@/components/motion/motion";
import type { SectionContent } from "@/lib/cms/sections";

const EASE = [0.22, 0.61, 0.36, 1] as const;

function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, ease: EASE, delay },
  };
}

/** Splits "Everyday snacking, naturally better." into two editorial lines. */
function splitHeadline(text: string): [string, string | null] {
  const idx = text.indexOf(",");
  if (idx > 0 && idx < text.length - 2) return [text.slice(0, idx + 1), text.slice(idx + 1).trim()];
  return [text, null];
}

export function Hero({
  content,
  productCount,
  packLabel,
}: {
  content: SectionContent<"hero">;
  productCount: number;
  packLabel: string | null;
}) {
  const [lineOne, lineTwo] = splitHeadline(content.headline);
  const hasMain = !!content.image_url;
  const hasSecondary = !!content.secondary_image_url;

  return (
    <section className="paper relative overflow-hidden" aria-labelledby="hero-heading">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 size-[44rem] rounded-full bg-[radial-gradient(circle_at_center,var(--color-sage-soft)_0%,transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-56 -left-40 size-[36rem] rounded-full bg-[radial-gradient(circle_at_center,rgb(226_179_60/0.10)_0%,transparent_60%)]"
      />
      <div className="container-site relative grid items-center gap-14 pb-20 pt-8 sm:pt-12 lg:grid-cols-12 lg:gap-10 lg:pb-28 lg:pt-14">
        <div className="relative lg:col-span-6">
          <LeafSprig className="absolute -left-6 -top-10 hidden h-36 w-24 text-sage animate-leaf-sway lg:block" />
          {content.eyebrow ? (
            <m.p className="eyebrow flex items-center gap-3" {...rise(0.05)}>
              <span aria-hidden="true" className="h-px w-10 bg-olive" />
              {content.eyebrow}
            </m.p>
          ) : null}
          <h1 id="hero-heading" className="mt-6 text-[2.75rem] leading-[1.02] sm:text-[3.7rem] lg:text-[4.5rem]">
            <span className="block">{lineOne}</span>
            {lineTwo ? <span className="block italic text-olive-ink">{lineTwo}</span> : null}
          </h1>
          {content.subheadline ? (
            <m.p className="mt-7 max-w-lg text-[1.08rem] leading-relaxed text-muted" {...rise(0.2)}>
              {content.subheadline}
            </m.p>
          ) : null}
          <m.div className="mt-10 flex flex-wrap items-center gap-3" {...rise(0.32)}>
            {content.primary_cta.label && content.primary_cta.href ? (
              <ButtonLink href={content.primary_cta.href} size="lg">
                {content.primary_cta.label}
              </ButtonLink>
            ) : null}
            {content.secondary_cta.label && content.secondary_cta.href ? (
              <ButtonLink href={content.secondary_cta.href} size="lg" variant="secondary">
                {content.secondary_cta.label}
              </ButtonLink>
            ) : null}
          </m.div>
        </div>

        <div className="relative lg:col-span-6">
          <Parallax distance={40} className="pointer-events-none absolute -right-16 -top-24 hidden h-[34rem] w-[22rem] text-sage/80 lg:block">
            <BananaLeaf className="size-full rotate-[18deg] animate-leaf-drift" />
          </Parallax>

          {hasMain ? (
            <div className="relative mx-auto aspect-square w-full max-w-[34rem]">
              <m.div
                className={hasSecondary ? "absolute right-0 top-0 w-[84%]" : "absolute inset-0"}
                initial={{ scale: 1.05, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ duration: 1.4, ease: EASE }}
              >
                <div className="relative aspect-square overflow-hidden rounded-[2.5rem] shadow-lift ring-1 ring-forest/5">
                  <Image
                    src={content.image_url}
                    alt={content.image_alt}
                    fill
                    priority
                    sizes="(min-width: 1024px) 40vw, 90vw"
                    className="object-cover"
                  />
                </div>
              </m.div>
              {hasSecondary ? (
                <Parallax distance={26} className="absolute bottom-0 left-0 w-[44%]">
                  <m.div
                    initial={{ opacity: 0, y: 30, rotate: -1 }}
                    animate={{ opacity: 1, y: 0, rotate: -4 }}
                    transition={{ duration: 1.1, ease: EASE, delay: 0.45 }}
                    className="relative aspect-square overflow-hidden rounded-[2rem] shadow-lift ring-[6px] ring-cream"
                  >
                    <Image
                      src={content.secondary_image_url}
                      alt={content.secondary_image_alt}
                      fill
                      sizes="(min-width: 1024px) 18vw, 40vw"
                      className="object-cover"
                    />
                  </m.div>
                </Parallax>
              ) : null}
              {productCount > 0 ? (
                <m.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.8 }}
                  className="absolute -bottom-5 right-6 flex items-center gap-3 rounded-2xl bg-paper/95 px-4 py-3 shadow-soft ring-1 ring-line backdrop-blur sm:right-10"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-sage-soft text-forest">
                    <Leaf className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-[0.78rem] leading-tight">
                    <span className="block font-semibold text-forest">
                      {productCount === 1 ? "Banana Chewy" : `${productCount} varieties`}
                    </span>
                    {packLabel ? <span className="text-muted">{packLabel}</span> : null}
                  </span>
                </m.div>
              ) : null}
            </div>
          ) : (
            <div className="relative mx-auto grid aspect-square w-full max-w-[30rem] place-items-center rounded-[3rem] bg-sage-soft/60">
              <BananaLeaf className="h-[85%] text-forest/40" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
