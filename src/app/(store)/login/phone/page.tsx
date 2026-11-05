import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { phoneSignInAvailable } from "@/lib/auth/phone";
import { isSafeInternalPath } from "@/lib/validation/common";
import { AuthShell } from "@/components/auth/auth-shell";
import { PhoneLoginForm } from "@/components/auth/phone-login";
import { FormMessage } from "@/components/ui/field";

export const metadata: Metadata = { title: "Sign in with mobile number", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function PhoneLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next && isSafeInternalPath(next) ? next : "/account";
  if (await getSessionUser()) redirect(target);
  const available = await phoneSignInAvailable();
  return (
    <AuthShell title="Sign in with mobile" description="New here? The same steps create your account.">
      {available ? <PhoneLoginForm next={target} /> : <FormMessage tone="info">Mobile sign-in isn&apos;t available right now. Please sign in with email.</FormMessage>}
      <p className="mt-6 text-center text-[0.88rem] text-muted">
        <Link href={`/login?next=${encodeURIComponent(target)}`} className="font-semibold text-forest underline underline-offset-4">
          Sign in with email instead
        </Link>
      </p>
    </AuthShell>
  );
}
