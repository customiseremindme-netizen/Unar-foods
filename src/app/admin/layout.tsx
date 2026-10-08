import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSessionUser, getStaffAccess } from "@/lib/auth/session";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getPublicSettings } from "@/lib/settings";
import { AdminShell } from "@/components/admin/shell";
import { ToastProvider } from "@/components/ui/toast";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · UNAR Dashboard" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  const access = await getStaffAccess();
  const settings = await getPublicSettings();

  if (!access) {
    // Signed in but not staff: show a minimal page without the dashboard navigation.
    return <ToastProvider>{children}</ToastProvider>;
  }

  const nav = ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => access.permissions.has(i.permission)) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <ToastProvider>
      <AdminShell
        nav={nav}
        email={user.email ?? ""}
        roleLabel={ROLE_LABELS[access.role]}
        logoUrl={settings.brand.logo_svg_url || settings.brand.logo_url}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
