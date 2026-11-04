import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPendingTwoStepUser, getSessionUser } from "@/lib/auth/session";
import { isSafeInternalPath } from "@/lib/validation/common";
import { AuthShell } from "@/components/auth/auth-shell";
import { TwoStepForm } from "@/components/auth/two-step";

export const metadata: Metadata = { title: "Two-step sign-in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TwoStepPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next && isSafeInternalPath(next) && !next.startsWith("/auth") ? next : "/account";
  if (await getSessionUser()) redirect(target);
  const pending = await getPendingTwoStepUser();
  if (!pending) redirect(`/login?next=${encodeURIComponent(target)}`);
  return (
    <AuthShell title="Enter your code" description="Open your authenticator app (Google Authenticator, Microsoft Authenticator or similar) and type the 6-digit code for UNAR.">
      <TwoStepForm next={target} />
    </AuthShell>
  );
}
