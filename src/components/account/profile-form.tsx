"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/actions/account";
import type { FormState } from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input } from "@/components/ui/field";

const initial: FormState = { ok: false, message: null };

export function ProfileForm({ profile }: { profile: { full_name: string; phone: string; marketing_consent: boolean; email: string } }) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  return (
    <form action={action} className="grid gap-5 rounded-[1.75rem] border border-line bg-paper p-6 sm:grid-cols-2" noValidate>
      {state.message ? (
        <div className="sm:col-span-2">
          <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage>
        </div>
      ) : null}
      <Field label="Full name" htmlFor="full_name" error={state.errors?.full_name}>
        <Input id="full_name" name="full_name" defaultValue={profile.full_name} autoComplete="name" />
      </Field>
      <Field label="Mobile number" htmlFor="phone" error={state.errors?.phone}>
        <Input id="phone" name="phone" defaultValue={profile.phone} inputMode="tel" autoComplete="tel-national" />
      </Field>
      <Field label="Email" htmlFor="email" hint="Contact us if you need to change your sign-in email." className="sm:col-span-2">
        <Input id="email" value={profile.email} disabled readOnly />
      </Field>
      <Checkbox
        className="sm:col-span-2"
        name="marketing_consent"
        defaultChecked={profile.marketing_consent}
        label="I'd like to hear about new products and offers"
      />
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          Save details
        </Button>
      </div>
    </form>
  );
}
