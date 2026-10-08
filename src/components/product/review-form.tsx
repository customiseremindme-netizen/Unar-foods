"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitReviewAction, type FormState } from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FormMessage, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const initial: FormState = { ok: false, message: null };

export function ReviewForm({ productId, productSlug }: { productId: string; productSlug: string }) {
  const [state, action, pending] = useActionState(submitReviewAction, initial);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  if (state.ok) return <FormMessage tone="success">{state.message}</FormMessage>;

  const needsLogin = state.message?.toLowerCase().includes("sign in");

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <fieldset>
        <legend className="mb-2 text-[0.82rem] font-semibold">
          Your rating <span className="text-danger" aria-hidden="true">*</span>
        </legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={rating === n}
              className="rounded-md p-1"
            >
              <Star
                aria-hidden="true"
                className={cn("size-7 transition-colors", n <= (hover || rating) ? "fill-banana text-banana" : "text-line")}
                strokeWidth={1.4}
              />
            </button>
          ))}
        </div>
        <FieldError message={state.errors?.rating} />
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name (shown publicly)" htmlFor="review-name" required error={state.errors?.author_name}>
          <Input id="review-name" name="author_name" autoComplete="given-name" maxLength={60} aria-invalid={!!state.errors?.author_name} />
        </Field>
        <Field label="Title (optional)" htmlFor="review-title" error={state.errors?.title}>
          <Input id="review-title" name="title" maxLength={120} />
        </Field>
      </div>
      <Field label="Your review" htmlFor="review-body" required error={state.errors?.body}>
        <Textarea id="review-body" name="body" rows={4} maxLength={2000} aria-invalid={!!state.errors?.body} />
      </Field>
      {state.message ? (
        <FormMessage tone="error">
          {state.message}{" "}
          {needsLogin ? (
            <Link href={`/login?next=${encodeURIComponent(`/products/${productSlug}#reviews`)}`} className="font-semibold underline">
              Sign in
            </Link>
          ) : null}
        </FormMessage>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={pending}>
          Submit review
        </Button>
        <p className="text-[0.78rem] text-muted">You need to be signed in. Reviews are checked before they appear.</p>
      </div>
    </form>
  );
}
