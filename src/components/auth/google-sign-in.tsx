export function GoogleSignIn({ next, available }: { next: string; available: boolean }) {
  return <div className="mb-6">
    {available ? <a href={`/auth/google?next=${encodeURIComponent(next)}`} className="inline-flex h-11 w-full items-center justify-center rounded-full border border-forest/35 bg-paper px-6 text-[0.875rem] font-semibold text-forest transition-colors hover:border-forest hover:bg-sage-soft">Continue with Google</a>
      : <p className="rounded-xl border border-line p-3 text-center text-[0.85rem] text-muted">Google sign-in is being set up. Use email sign-in below.</p>}
    <p className="mt-4 text-center text-[0.75rem] text-muted">Your account, your daily healthy habit.</p>
  </div>;
}
