import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResendVerificationForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false, follow: true } };

export default function ResendVerificationPage() {
  return (
    <AuthShell title="Confirm your email" description="Missing your confirmation email? Request a new link to finish setting up your account.">
      <ResendVerificationForm />
      <p className="mt-6 text-center text-[0.88rem]"><Link href="/login" className="text-forest underline underline-offset-4">Back to sign in</Link></p>
    </AuthShell>
  );
}
