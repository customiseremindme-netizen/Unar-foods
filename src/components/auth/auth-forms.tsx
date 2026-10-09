"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { forgotPasswordAction, registerAction, signInAction, updatePasswordAction } from "@/app/actions/auth";
import { setupOwnerAction } from "@/app/actions/setup";
import type { FormState } from "@/app/actions/engagement";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input } from "@/components/ui/field";

const initial: FormState = { ok: false, message: null };

function PasswordInput({ id, name, autoComplete, invalid }: { id: string; name: string; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className="pr-12"
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-forest"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {linkError ? <FormMessage tone="error">That link is invalid or has expired. Please sign in or request a new link.</FormMessage> : null}
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      <Field label="Email" htmlFor="email" error={state.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!state.errors?.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={state.errors?.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" invalid={!!state.errors?.password} />
      </Field>
      <div className="flex items-center justify-between">
        <Link href="/forgot-password" className="text-[0.85rem] text-forest underline underline-offset-4">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
      <p className="text-center text-[0.88rem] text-muted">
        New to UNAR?{" "}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-forest underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(registerAction, initial);
  if (state.ok) {
    return (
      <div className="space-y-5">
        <FormMessage tone="success">{state.message}</FormMessage>
        <ButtonLink href="/login" variant="secondary" className="w-full">
          Back to sign in
        </ButtonLink>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      <Field label="Full name" htmlFor="full_name" error={state.errors?.full_name}>
        <Input id="full_name" name="full_name" autoComplete="name" required aria-invalid={!!state.errors?.full_name} />
      </Field>
      <Field label="Email" htmlFor="email" error={state.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!state.errors?.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={state.errors?.password} hint="At least 8 characters, with a letter and a number">
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!state.errors?.password} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={state.errors?.confirm}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" invalid={!!state.errors?.confirm} />
      </Field>
      <Checkbox name="marketing" label="Email me about new products and offers (optional)" />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create account
      </Button>
      <p className="text-center text-[0.8rem] text-muted">
        By creating an account you agree to our{" "}
        <Link href="/policies/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/policies/privacy-policy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
      <p className="text-center text-[0.88rem] text-muted">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-forest underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);
  if (state.ok) return <FormMessage tone="success">{state.message}</FormMessage>;
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      <Field label="Email" htmlFor="email" error={state.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!state.errors?.email} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initial);
  if (state.ok) {
    return (
      <div className="space-y-5">
        <FormMessage tone="success">{state.message}</FormMessage>
        <ButtonLink href="/account" className="w-full">
          Go to my account
        </ButtonLink>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      <Field label="New password" htmlFor="password" error={state.errors?.password} hint="At least 8 characters, with a letter and a number">
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!state.errors?.password} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={state.errors?.confirm}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" invalid={!!state.errors?.confirm} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Update password
      </Button>
    </form>
  );
}

export function SetupOwnerForm() {
  const [state, action, pending] = useActionState(setupOwnerAction, initial);
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      <Field label="Setup key" htmlFor="setup_key" error={state.errors?.setup_key} hint="The SETUP_KEY you saved in Hostinger">
        <PasswordInput id="setup_key" name="setup_key" autoComplete="off" invalid={!!state.errors?.setup_key} />
      </Field>
      <Field label="Your name" htmlFor="full_name" error={state.errors?.full_name}>
        <Input id="full_name" name="full_name" autoComplete="name" required aria-invalid={!!state.errors?.full_name} />
      </Field>
      <Field label="Email" htmlFor="email" error={state.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!state.errors?.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={state.errors?.password} hint="At least 8 characters, with a letter and a number">
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!state.errors?.password} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={state.errors?.confirm}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" invalid={!!state.errors?.confirm} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create owner account
      </Button>
    </form>
  );
}
