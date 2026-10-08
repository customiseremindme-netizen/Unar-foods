import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isSafeInternalPath } from "@/lib/validation/common";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create an account", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next && isSafeInternalPath(next) ? next : "/account";
  if (await getSessionUser()) redirect(target);
  return (
    <AuthShell title="Create your account" description="Track orders, save addresses and check out faster.">
      <RegisterForm next={target} />
    </AuthShell>
  );
}
