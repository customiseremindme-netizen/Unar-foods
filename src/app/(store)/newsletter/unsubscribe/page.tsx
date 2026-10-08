import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { UnsubscribeForm } from "@/components/content/unsubscribe-form";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Unsubscribe" description="Stop receiving marketing emails from UNAR. Order emails are not affected.">
      {token ? <UnsubscribeForm token={token} /> : <p className="text-muted">This unsubscribe link is incomplete. Please use the link from your email.</p>}
    </AuthShell>
  );
}
