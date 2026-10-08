"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MapPin, Package, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/account", label: "Overview", icon: User },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/profile", label: "Profile & password", icon: Settings },
];

export function AccountNav({ isStaff }: { isStaff: boolean }) {
  const pathname = usePathname();
  const links = isStaff ? [...LINKS, { href: "/admin", label: "Admin dashboard", icon: LayoutDashboard }] : LINKS;
  return (
    <nav aria-label="Account">
      <ul className="flex gap-2 overflow-x-auto lg:flex-col">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/account" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-full px-4 py-2.5 text-[0.9rem] transition-colors lg:rounded-xl",
                  active ? "bg-forest text-cream" : "text-graphite hover:bg-forest/[0.06]",
                )}
              >
                <Icon className="size-4" aria-hidden="true" /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
