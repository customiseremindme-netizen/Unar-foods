import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";

/** Friendly "page not found" with a picture, used inside and outside the shop layout. */
export function NotFoundContent() {
  return (
    <section className="relative overflow-hidden py-12 md:py-20 lg:py-28">
      <div className="container-site relative grid max-w-4xl items-center gap-8 md:grid-cols-2 md:gap-10">
        <div className="relative mx-auto aspect-square w-full max-w-[13rem] overflow-hidden rounded-[2rem] shadow-soft md:max-w-sm md:rounded-[2.5rem]">
          <Image src="/images/site/single-banana.webp" alt="A single banana on its own" fill sizes="(min-width: 768px) 384px, 80vw" className="object-cover" priority />
        </div>
        <div className="text-center md:text-left">
          <p className="eyebrow">Page not found</p>
          <h1 className="mt-4 text-[2.1rem] md:text-[2.6rem]">This one slipped away</h1>
          <p className="mt-4 text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved. Our snacks are still right here.</p>
          <div className="mt-8 flex justify-center gap-3 md:justify-start">
            <ButtonLink href="/shop">Shop Banana Chewy</ButtonLink>
            <ButtonLink href="/" variant="secondary">
              Go home
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
