"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Heart, LayoutDashboard, MapPin, Package, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/account", label: "Overview", icon: User },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/profile", label: "Profile & password", icon: Settings },
];

export function AccountNav({ isStaff }: { isStaff: boolean }) {
  const pathname = usePathname();
  const links = isStaff ? [...LINKS, { href: "/admin", label: "Admin dashboard", icon: LayoutDashboard }] : LINKS;
  const list = useRef<HTMLUListElement>(null);
  // On phones the tabs scroll sideways: bring the current one into view.
  useEffect(() => {
    const ul = list.current;
    const active = ul?.querySelector<HTMLElement>("[aria-current=page]");
    if (!ul || !active || ul.scrollWidth <= ul.clientWidth) return;
    ul.scrollLeft = active.offsetLeft - ul.offsetLeft - 16;
  }, [pathname]);
  return (
    <nav aria-label="Account">
      <ul ref={list} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/account" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0 snap-start">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-[0.9rem] ring-1 ring-line transition-colors lg:gap-3 lg:rounded-xl lg:ring-0",
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
