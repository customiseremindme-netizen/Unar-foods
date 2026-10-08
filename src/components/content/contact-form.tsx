"use client";

import { useActionState } from "react";
import { submitContactAction, type FormState } from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";

const initial: FormState = { ok: false, message: null };

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContactAction, initial);
  if (state.ok) return <FormMessage tone="success">{state.message}</FormMessage>;
  const e = state.errors ?? {};
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2" noValidate>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.message ? (
        <div className="sm:col-span-2">
          <FormMessage tone="error">{state.message}</FormMessage>
        </div>
      ) : null}
      <Field label="Your name" htmlFor="name" required error={e.name}>
        <Input id="name" name="name" autoComplete="name" aria-invalid={!!e.name} />
      </Field>
      <Field label="Email" htmlFor="contact-email" required error={e.email}>
        <Input id="contact-email" name="email" type="email" autoComplete="email" aria-invalid={!!e.email} />
      </Field>
      <Field label="Phone (optional)" htmlFor="contact-phone" error={e.phone}>
        <Input id="contact-phone" name="phone" inputMode="tel" autoComplete="tel" />
      </Field>
      <Field label="Subject (optional)" htmlFor="subject" error={e.subject}>
        <Input id="subject" name="subject" maxLength={160} />
      </Field>
      <Field label="Message" htmlFor="message" required error={e.message} className="sm:col-span-2" hint="Include your order number if your message is about an order.">
        <Textarea id="message" name="message" rows={6} maxLength={4000} aria-invalid={!!e.message} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" loading={pending}>
          Send message
        </Button>
        <p className="mt-3 text-[0.78rem] text-muted">We use your details only to reply to your message.</p>
      </div>
    </form>
  );
}
