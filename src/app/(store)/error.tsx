"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="container-site max-w-xl py-28 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-4 text-[2.4rem]">We hit a snag</h1>
      <p className="mt-4 text-muted">Please try again. If the problem continues, contact us and we&apos;ll help.</p>
      {error.digest ? <p className="mt-2 text-[0.75rem] text-muted">Reference: {error.digest}</p> : null}
      <div className="mt-8 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Go home
        </ButtonLink>
      </div>
    </section>
  );
}
