import { ButtonLink } from "@/components/ui/button";
import { LeafSprig } from "@/components/brand/botanical";

export default function NotFound() {
  return (
    <section className="relative overflow-hidden py-28">
      <LeafSprig className="absolute left-1/2 top-4 h-40 w-28 -translate-x-1/2 text-sage" />
      <div className="container-site relative max-w-xl pt-32 text-center">
        <p className="eyebrow">Page not found</p>
        <h1 className="mt-4 text-[2.6rem]">This path leads nowhere</h1>
        <p className="mt-4 text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/">Go home</ButtonLink>
          <ButtonLink href="/shop" variant="secondary">
            Shop
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
