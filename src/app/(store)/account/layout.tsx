import type { ReactNode } from "react";
import type { Metadata } from "next";
import { requireUser, getStaffAccess } from "@/lib/auth/session";
import { signOutAction } from "@/app/actions/auth";
import { AccountNav } from "@/components/account/account-nav";

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/account");
  const staff = await getStaffAccess();
  return (
    <div className="container-site py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My account</p>
          <p className="mt-2 text-[0.9rem] text-muted">Signed in as {user.email}</p>
        </div>
        <form action={signOutAction}>
          <button className="text-[0.85rem] font-semibold text-forest underline underline-offset-4">Sign out</button>
        </form>
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <AccountNav isStaff={!!staff} />
        </aside>
        <div className="lg:col-span-9">{children}</div>
      </div>
    </div>
  );
}
