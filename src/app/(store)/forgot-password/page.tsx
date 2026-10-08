import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false, follow: true } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" description="Enter your email and we'll send you a link to set a new password.">
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-[0.88rem]">
        <Link href="/login" className="text-forest underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
