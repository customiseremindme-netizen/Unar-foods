import type { Metadata } from "next";
import { confirmLinkAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button, ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Confirm", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Search = Promise<{ token?: string; type?: string; next?: string }>;

/**
 * Landing page for emailed links. The link only opens this page; pressing the
 * button finishes the step. That way email security scanners that open links
 * automatically can't use up a one-time link before the customer does.
 */
export default async function ConfirmPage({ searchParams }: { searchParams: Search }) {
  const { token, type, next } = await searchParams;
  const recovery = type === "recovery";
  if (!token || (type !== "signup" && type !== "recovery")) {
    return (
      <AuthShell title="This link isn't complete">
        <div className="space-y-5">
          <p className="text-muted">Please open the link from your email again, or request a new one.</p>
          <ButtonLink href="/login" className="w-full">
            Go to sign in
          </ButtonLink>
        </div>
      </AuthShell>
    );
  }
  return (
    <AuthShell
      title={recovery ? "Reset your password" : "Confirm your email"}
      description={recovery ? "Continue to choose a new password for your account." : "One last step to activate your account."}
    >
      <form action={confirmLinkAction} className="space-y-5">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next ?? ""} />
        <Button type="submit" size="lg" className="w-full">
          {recovery ? "Continue" : "Confirm my email"}
        </Button>
      </form>
    </AuthShell>
  );
}
