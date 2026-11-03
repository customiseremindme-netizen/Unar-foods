import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isSafeInternalPath } from "@/lib/validation/common";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-forms";
import { FormMessage } from "@/components/ui/field";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getEmailEnv, getGoogleEnv } from "@/lib/env";
import { GoogleButton } from "@/components/auth/google-button";

export const metadata: Metadata = { title: "Create an account", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next && isSafeInternalPath(next) ? next : "/account";
  if (await getSessionUser()) redirect(target);
  return (
    <AuthShell title="Create your account" description="Track orders, save addresses and check out faster.">
      {isDatabaseConfigured() ? (
        <>
          {getGoogleEnv() ? <GoogleButton next={target} label="Sign up with Google" /> : null}
          <RegisterForm next={target} emailVerification={!!getEmailEnv()} />
        </>
      ) : (
        <FormMessage tone="info">
          Accounts open as soon as our shop&apos;s database is connected. Please check back shortly — or contact us if you need help with an order.
        </FormMessage>
      )}
    </AuthShell>
  );
}
