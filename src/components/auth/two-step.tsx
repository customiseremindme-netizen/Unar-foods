"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  beginTwoStepSetupAction,
  confirmTwoStepSetupAction,
  disableTwoStepAction,
  newRecoveryCodesAction,
  signOutEverywhereAction,
  verifyTwoStepAction,
  type TwoStepSetup,
} from "@/app/actions/security";
import type { FormState } from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";

const initial: FormState = { ok: false, message: null };

/** The code step of signing in. */
export function TwoStepForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(verifyTwoStepAction, initial);
  const [recovery, setRecovery] = useState(false);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      <Field label={recovery ? "Recovery code" : "6-digit code"} htmlFor="code">
        <Input
          id="code"
          name="code"
          autoComplete="one-time-code"
          inputMode={recovery ? "text" : "numeric"}
          placeholder={recovery ? "XXXX-XXXX-XXXX" : "123456"}
          maxLength={recovery ? 20 : 6}
          autoFocus
          required
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Continue
      </Button>
      <button type="button" className="text-[0.85rem] text-forest underline underline-offset-4" onClick={() => setRecovery((r) => !r)}>
        {recovery ? "Use the code from my app instead" : "Lost your phone? Use a recovery code"}
      </button>
    </form>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="space-y-3 rounded-2xl border border-banana/60 bg-banana-soft/40 p-4">
      <p className="text-[0.88rem] font-semibold text-forest">Save these recovery codes now — they are shown only once.</p>
      <p className="text-[0.8rem] text-muted">Each works once if you lose your phone. Keep them in your password manager or print them.</p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-[0.9rem]" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c} className="rounded-lg bg-paper px-3 py-1.5 text-center ring-1 ring-line">
            {c}
          </li>
        ))}
      </ul>
      <Button type="button" size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(codes.join("\n")).catch(() => undefined)}>
        Copy codes
      </Button>
    </div>
  );
}

/** Account → Security: switch two-step sign-in on/off, recovery codes, sign out everywhere. */
export function SecuritySettings({ enabled, recoveryLeft, mustSetUp }: { enabled: boolean; recoveryLeft: number; mustSetUp: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<TwoStepSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[1.75rem] border border-line bg-paper p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-sans text-[1.05rem] font-semibold tracking-normal">
          <ShieldCheck className="size-5 text-olive" aria-hidden="true" /> Two-step sign-in
        </h2>
        <p className="mt-2 text-[0.9rem] text-muted">
          After your password, you also type a 6-digit code from an authenticator app on your phone — so a stolen password alone can&apos;t open your account.
        </p>
        {mustSetUp && !enabled ? (
          <div className="mt-4">
            <FormMessage tone="info">Staff accounts must switch this on before the dashboard opens.</FormMessage>
          </div>
        ) : null}
        {message ? (
          <div className="mt-4">
            <FormMessage tone={message.ok ? "success" : "error"}>{message.text}</FormMessage>
          </div>
        ) : null}

        {codes ? (
          <div className="mt-5 space-y-4">
            <RecoveryCodes codes={codes} />
            <Button
              type="button"
              onClick={() => {
                setCodes(null);
                setSetup(null);
                setMessage(null);
                router.refresh();
              }}
            >
              I&apos;ve saved them
            </Button>
          </div>
        ) : enabled ? (
          <div className="mt-5 space-y-5">
            <p className="text-[0.9rem] font-semibold text-success">On · {recoveryLeft} recovery code{recoveryLeft === 1 ? "" : "s"} left</p>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Current code from your app" htmlFor="sec-code">
                <Input id="sec-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={20} className="h-11 w-48" autoComplete="one-time-code" />
              </Field>
              <Button
                type="button"
                variant="secondary"
                loading={busy}
                disabled={code.trim().length < 6}
                onClick={() =>
                  run(async () => {
                    const r = await newRecoveryCodesAction(code);
                    if (r.ok && r.recoveryCodes) setCodes(r.recoveryCodes);
                    else setMessage({ ok: false, text: r.message ?? "That didn't work." });
                    setCode("");
                  })
                }
              >
                New recovery codes
              </Button>
            </div>
            {!mustSetUp ? (
              <details className="text-[0.88rem]">
                <summary className="cursor-pointer text-forest underline underline-offset-4">Switch two-step sign-in off</summary>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <Field label="Password" htmlFor="sec-pw">
                    <Input id="sec-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-56" autoComplete="current-password" />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-danger"
                    loading={busy}
                    disabled={!password || code.trim().length < 6}
                    onClick={() =>
                      run(async () => {
                        const r = await disableTwoStepAction(password, code);
                        setMessage({ ok: r.ok, text: r.message });
                        setPassword("");
                        setCode("");
                        if (r.ok) router.refresh();
                      })
                    }
                  >
                    Switch off (needs the code above too)
                  </Button>
                </div>
              </details>
            ) : null}
          </div>
        ) : setup?.qrSvg ? (
          <div className="mt-5 grid gap-6 sm:grid-cols-[12rem_1fr]">
            <div>
              <div className="overflow-hidden rounded-xl bg-white p-2 ring-1 ring-line" role="img" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
              <p className="mt-2 break-all text-center font-mono text-[0.7rem] text-muted">{setup.secret}</p>
            </div>
            <div className="space-y-4 text-[0.9rem]">
              <ol className="list-decimal space-y-1.5 pl-5 text-muted">
                <li>Install Google Authenticator or Microsoft Authenticator on your phone.</li>
                <li>Tap “+” and scan this QR code (or type the key under it).</li>
                <li>Type the 6-digit code the app shows.</li>
              </ol>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="6-digit code" htmlFor="setup-code">
                  <Input id="setup-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} className="h-11 w-40" autoComplete="one-time-code" />
                </Field>
                <Button
                  type="button"
                  loading={busy}
                  disabled={code.trim().length !== 6}
                  onClick={() =>
                    run(async () => {
                      const r = await confirmTwoStepSetupAction(code);
                      if (r.ok && r.recoveryCodes) {
                        setCodes(r.recoveryCodes);
                        setMessage({ ok: true, text: "Two-step sign-in is on." });
                      } else setMessage({ ok: false, text: r.message ?? "That didn't work." });
                      setCode("");
                    })
                  }
                >
                  Switch on
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <Button
              type="button"
              loading={busy}
              onClick={() =>
                run(async () => {
                  const r = await beginTwoStepSetupAction();
                  if (r.ok) setSetup(r);
                  else setMessage({ ok: false, text: r.message ?? "That didn't work." });
                })
              }
            >
              Set up two-step sign-in
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-line bg-paper p-5 sm:p-6">
        <h2 className="font-sans text-[1.05rem] font-semibold tracking-normal">Signed in somewhere else?</h2>
        <p className="mt-2 text-[0.9rem] text-muted">Sign out on every other phone and computer. This browser stays signed in.</p>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          loading={busy}
          onClick={() =>
            run(async () => {
              const r = await signOutEverywhereAction();
              setMessage({ ok: r.ok, text: r.message });
            })
          }
        >
          Sign out everywhere else
        </Button>
      </section>
    </div>
  );
}
