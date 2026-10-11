import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isSafeInternalPath } from "@/lib/validation/common";
import { getGoogleEnv } from "@/lib/env";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const target = next && isSafeInternalPath(next) ? next : "/account";
  if (await getSessionUser()) redirect(target);
  return (
    <AuthShell title="Welcome back" description="Sign in to see your orders, saved addresses and faster checkout.">
      {error === "google" ? <p role="alert" className="mb-5 rounded-xl bg-danger-soft p-4 text-[0.9rem] text-danger">Google sign-in could not be completed. Try again, or use your existing email and password. Staff and unconfirmed existing accounts must use email sign-in.</p> : null}
      <GoogleSignIn next={target} available={!!getGoogleEnv()} />
      <LoginForm next={target} linkError={error === "link"} />
    </AuthShell>
  );
}
