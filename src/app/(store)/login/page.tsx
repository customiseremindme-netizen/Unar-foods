import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isSafeInternalPath } from "@/lib/validation/common";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";
import { GoogleButton } from "@/components/auth/google-button";
import { FormMessage } from "@/components/ui/field";
import { getGoogleEnv } from "@/lib/env";

const GOOGLE_ERRORS: Record<string, string> = {
  google: "Google sign-in didn't work. Please try again, or sign in with your email and password.",
  google_cancelled: "Google sign-in was cancelled.",
  google_busy: "Too many sign-in attempts. Please wait a few minutes and try again.",
  google_off: "Google sign-in isn't available. Please use your email and password.",
};

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const target = next && isSafeInternalPath(next) ? next : "/account";
  if (await getSessionUser()) redirect(target);
  return (
    <AuthShell title="Welcome back" description="Sign in to see your orders, saved addresses and faster checkout.">
      {error && GOOGLE_ERRORS[error] ? (
        <div className="mb-5">
          <FormMessage tone="error">{GOOGLE_ERRORS[error]}</FormMessage>
        </div>
      ) : null}
      {getGoogleEnv() ? <GoogleButton next={target} /> : null}
      <LoginForm next={target} linkError={error === "link"} />
    </AuthShell>
  );
}
