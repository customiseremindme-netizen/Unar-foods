import { ButtonLink } from "@/components/ui/button";

export function GoogleSignIn({ next, available }: { next: string; available: boolean }) {
  return <div className="mb-6">
    {available ? <ButtonLink href={`/auth/google?next=${encodeURIComponent(next)}`} variant="secondary" className="w-full">Continue with Google</ButtonLink>
      : <p className="rounded-xl border border-line p-3 text-center text-[0.85rem] text-muted">Google sign-in is being set up. Use email sign-in below.</p>}
    <p className="mt-4 text-center text-[0.75rem] text-muted">Your account, your daily healthy habit.</p>
  </div>;
}
