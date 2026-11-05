"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import {
  completePhoneSignupAction,
  confirmLinkPhoneAction,
  removeLinkedPhoneAction,
  requestLinkPhoneCodeAction,
  requestPhoneLoginCodeAction,
  verifyPhoneLoginCodeAction,
} from "@/app/actions/phone-auth";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { useRouter } from "next/navigation";

/** Link on the sign-in page. */
export function PhoneLoginLink({ next }: { next: string }) {
  return (
    <Link
      href={`/login/phone?next=${encodeURIComponent(next)}`}
      className="mb-5 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line bg-paper text-[0.95rem] font-semibold text-graphite transition-colors hover:border-forest"
    >
      <MessageCircle className="size-5 text-[#25D366]" aria-hidden="true" /> Sign in with mobile number
    </Link>
  );
}

/** Mobile number → 6-digit code on WhatsApp → signed in (new customers also give their name and email). */
export function PhoneLoginForm({ next }: { next: string }) {
  const [step, setStep] = useState<"phone" | "code" | "details">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [masked, setMasked] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const go = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    go(async () => {
      const r = await requestPhoneLoginCodeAction(phone);
      if (!r.ok) return setMessage({ tone: "error", text: r.message ?? "We couldn't send the code." });
      setMasked(r.masked ?? "");
      setCode("");
      setStep("code");
      setMessage({ tone: "info", text: `We sent a 6-digit code on WhatsApp to ${r.masked}.` });
    });

  if (step === "details") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void go(async () => {
            const r = await completePhoneSignupAction({ full_name: name, email, next });
            if (r && !r.ok) {
              setErrors(r.errors ?? {});
              setMessage({ tone: "error", text: r.message ?? "Please try again." });
            }
          });
        }}
      >
        <p className="text-[0.9rem] text-muted">Welcome! {masked} is confirmed. Tell us your name and email for order emails and invoices.</p>
        {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
        <Field label="Full name" htmlFor="pl-name" required error={errors.full_name}>
          <Input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-12" />
        </Field>
        <Field label="Email" htmlFor="pl-email" required error={errors.email}>
          <Input id="pl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-12" />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create my account
        </Button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "phone") return void sendCode();
        void go(async () => {
          const r = await verifyPhoneLoginCodeAction(phone, code, next);
          if (!r) return;
          if (!r.ok) return setMessage({ tone: "error", text: r.message ?? "That code didn't work." });
          if (r.step === "details") {
            setMessage(null);
            setStep("details");
          }
        });
      }}
    >
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <Field label="Mobile number" htmlFor="pl-phone" required hint="We'll send a 6-digit code on WhatsApp.">
        <Input
          id="pl-phone"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (step === "code") setStep("phone");
          }}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="98765 43210"
          className="h-12"
        />
      </Field>
      {step === "code" ? (
        <Field label="Code from WhatsApp" htmlFor="pl-code" required>
          <Input
            id="pl-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="h-12 text-center font-mono text-[1.2rem] tracking-[0.4em]"
            autoFocus
          />
        </Field>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={step === "code" ? code.length !== 6 : phone.replace(/\D/g, "").length < 10}>
        {step === "phone" ? "Send code on WhatsApp" : "Sign in"}
      </Button>
      {step === "code" ? (
        <button type="button" onClick={() => void sendCode()} disabled={busy} className="w-full text-center text-[0.85rem] font-semibold text-forest underline underline-offset-4">
          Send a new code
        </button>
      ) : null}
    </form>
  );
}

/** Account → Security: link (or remove) a mobile number for WhatsApp-code sign-in. */
export function LinkPhoneCard({ linked }: { linked: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const go = async (fn: () => Promise<{ ok: boolean; message: string | null }>, after?: () => void) => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fn();
      if (r.message) setMessage({ ok: r.ok, text: r.message });
      if (r.ok) after?.();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-[1.75rem] border border-line bg-paper p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-sans text-[1.05rem] font-semibold tracking-normal">
        <MessageCircle className="size-5 text-olive" aria-hidden="true" /> Sign in with mobile number
      </h2>
      <p className="mt-2 text-[0.9rem] text-muted">Get a 6-digit code on WhatsApp instead of typing your password.</p>
      {message ? (
        <div className="mt-4">
          <FormMessage tone={message.ok ? "success" : "error"}>{message.text}</FormMessage>
        </div>
      ) : null}
      {linked ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-[0.9rem] font-semibold text-success">On · {linked}</p>
          <Button type="button" size="sm" variant="ghost" loading={busy} onClick={() => go(removeLinkedPhoneAction, () => router.refresh())}>
            Remove
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Mobile number" htmlFor="link-phone">
            <Input id="link-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" className="h-11 w-48" />
          </Field>
          {sent ? (
            <>
              <Field label="Code from WhatsApp" htmlFor="link-code">
                <Input id="link-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="h-11 w-36 font-mono" />
              </Field>
              <Button type="button" size="sm" loading={busy} disabled={code.length !== 6} onClick={() => go(() => confirmLinkPhoneAction(phone, code), () => router.refresh())}>
                Confirm
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => go(() => requestLinkPhoneCodeAction(phone), () => setSent(true))}>
              Send code on WhatsApp
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
