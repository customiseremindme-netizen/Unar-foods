"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Boxes,
  ChartColumn,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  Mail,
  Megaphone,
  Menu,
  MessageSquareQuote,
  Package,
  PanelsTopLeft,
  Plug,
  ScrollText,
  Settings,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AdminNavItem } from "@/lib/admin/nav";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "clipboard-list": ClipboardList,
  package: Package,
  boxes: Boxes,
  users: Users,
  mail: Mail,
  "message-square-quote": MessageSquareQuote,
  "panels-top-left": PanelsTopLeft,
  megaphone: Megaphone,
  "chart-column": ChartColumn,
  truck: Truck,
  settings: Settings,
  plug: Plug,
  "user-cog": UserCog,
  "scroll-text": ScrollText,
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The child link with the longest matching path is the active one. */
function bestChild(pathname: string, children: { href: string }[]) {
  return children
    .filter((c) => pathname === c.href || pathname.startsWith(`${c.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function NavList({ nav, pathname, onNavigate }: { nav: { group: string; items: AdminNavItem[] }[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Dashboard" className="space-y-7">
      {nav.map((group) => (
        <div key={group.group}>
          <p className="mb-2 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">{group.group}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active =
                isActive(pathname, item.href) || (item.children?.some((c) => isActive(pathname, c.href)) ?? false);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-[0.88rem] transition-colors",
                      active ? "bg-forest text-cream" : "text-graphite hover:bg-forest/[0.06]",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                  {item.children && active ? (
                    <ul className="mb-2 ml-9 mt-1 space-y-0.5 border-l border-line pl-3">
                      {item.children.map((child) => {
                        const childActive = bestChild(pathname, item.children!) === child.href;
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={onNavigate}
                              aria-current={childActive ? "page" : undefined}
                              className={cn(
                                "block rounded-lg px-2 py-1.5 text-[0.82rem]",
                                childActive ? "font-semibold text-forest" : "text-muted hover:text-forest",
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({
  nav,
  email,
  roleLabel,
  logoUrl,
  children,
}: {
  nav: { group: string; items: AdminNavItem[] }[];
  email: string;
  roleLabel: string;
  logoUrl: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const footer = (
    <div className="space-y-3 border-t border-line pt-4 text-[0.8rem]">
      <div>
        <p className="truncate font-semibold text-graphite">{email}</p>
        <p className="text-muted">{roleLabel}</p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/" target="_blank" className="inline-flex items-center gap-1 text-forest hover:underline">
          View store <ExternalLink className="size-3" aria-hidden="true" />
        </Link>
        <Link href="/account" className="text-forest hover:underline">
          My account
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r border-line bg-paper px-4 py-6 lg:flex">
        <Link href="/admin" className="block w-36 px-2">
          <Image src={logoUrl} alt="UNAR dashboard" width={960} height={307} className="h-auto w-full" priority />
        </Link>
        <div className="flex-1">
          <NavList nav={nav} pathname={pathname} />
        </div>
        {footer}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid size-10 place-items-center rounded-full text-forest hover:bg-forest/[0.06]"
            aria-label="Open dashboard menu"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <Link href="/admin" className="w-28">
            <Image src={logoUrl} alt="UNAR dashboard" width={960} height={307} className="h-auto w-full" />
          </Link>
        </header>
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} side="left" title="Dashboard" labelledBy="admin-menu-title">
        <div className="flex h-full flex-col gap-6 px-4 py-5">
          <div className="flex-1">
            <NavList nav={nav} pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
          {footer}
        </div>
      </Sheet>
    </div>
  );
}
