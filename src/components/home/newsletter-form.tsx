"use client";

import { useActionState } from "react";
import { subscribeNewsletterAction, type FormState } from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldError, FormMessage, Input } from "@/components/ui/field";

const initial: FormState = { ok: false, message: null };

export function NewsletterForm({ consentText, source }: { consentText: string; source: string }) {
  const [state, action, pending] = useActionState(subscribeNewsletterAction, initial);

  if (state.ok && state.message) return <FormMessage tone="success">{state.message}</FormMessage>;

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="source" value={source} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor={`website-${source}`}>Leave this field empty</label>
        <input id={`website-${source}`} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor={`newsletter-email-${source}`} className="sr-only">
            Email address
          </label>
          <Input
            id={`newsletter-email-${source}`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-invalid={!!state.errors?.email}
            aria-describedby={state.errors?.email ? `newsletter-email-${source}-error` : undefined}
            className="bg-paper"
          />
          <FieldError id={`newsletter-email-${source}-error`} message={state.errors?.email} />
        </div>
        <Button type="submit" size="lg" loading={pending} className="sm:self-start">
          Subscribe
        </Button>
      </div>
      <Checkbox name="consent" label={consentText} required aria-invalid={!!state.errors?.consent} />
      <FieldError message={state.errors?.consent} />
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
    </form>
  );
}
