import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const user = await getSessionUser();
  // Opened from a reset link: no need for the old password.
  const fromLink = (await cookies()).has("unar_reset");
  return (
    <AuthShell title="Set a new password">
      {user ? (
        <ResetPasswordForm requireCurrent={!fromLink} />
      ) : (
        <div className="space-y-5">
          <p className="text-muted">Your reset link has expired or was already used. Please request a new one.</p>
          <ButtonLink href="/forgot-password" className="w-full">
            Request a new link
          </ButtonLink>
        </div>
      )}
    </AuthShell>
  );
}
