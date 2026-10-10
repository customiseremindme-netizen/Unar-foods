"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Menu, Search, ShoppingBag, User } from "lucide-react";
import { Logo, type LogoConfig } from "@/components/brand/logo";
import { Sheet } from "@/components/ui/sheet";
import { useCart } from "@/components/cart/cart-context";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";

export type NavLink = { label: string; href: string };
export type SearchItem = { slug: string; title: string; subtitle: string | null; imageUrl: string | null; imageAlt: string; pricePaise: number | null };

function isActive(pathname: string, href: string) {
  if (href.startsWith("/#")) return false;
  const path = href.split("?")[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

export function SiteHeader({
  logo,
  links,
  searchIndex,
  contact,
  sticky = true,
}: {
  sticky?: boolean;
  logo: LogoConfig;
  links: NavLink[];
  searchIndex: SearchItem[];
  contact: { email: string; phone: string };
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { state, openDrawer } = useCart();
  const count = state?.cart.itemCount ?? 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus after navigating (state adjusted during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  const iconBtn =
    "relative grid size-11 place-items-center rounded-full text-forest transition-colors duration-300 hover:bg-forest/[0.07]";

  return (
    <>
      <header
        className={cn(
          "z-40 transition-[background-color,box-shadow,border-color] duration-500",
          sticky ? "sticky top-0" : "relative",
          scrolled
            ? "border-b border-line/70 bg-cream/90 shadow-[0_8px_30px_-24px_rgb(46_78_54/0.5)] backdrop-blur-md"
            : "border-b border-transparent bg-cream",
        )}
      >
        <div className="container-site flex h-[4.5rem] items-center gap-3 lg:h-20">
          <button
            type="button"
            className={cn(iconBtn, "-ml-2 lg:hidden")}
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>

          <div className="mx-auto w-[150px] shrink-0 sm:w-[170px] lg:mx-0 lg:w-[190px]">
            <Logo logo={logo} priority />
          </div>

          <nav aria-label="Main" className="hidden flex-1 justify-center lg:flex">
            <ul className="flex items-center gap-8">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive(pathname, link.href) ? "page" : undefined}
                    className="link-underline text-[0.84rem] font-medium tracking-[0.02em] text-graphite transition-colors hover:text-forest aria-[current=page]:text-forest"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-0.5 lg:gap-1">
            <button type="button" className={cn(iconBtn, "hidden sm:grid")} onClick={() => setSearchOpen(true)} aria-label="Search products">
              <Search className="size-[1.15rem]" aria-hidden="true" />
            </button>
            <Link href="/account" className={cn(iconBtn, "hidden sm:grid")} aria-label="My account">
              <User className="size-[1.15rem]" aria-hidden="true" />
            </Link>
            <button
              type="button"
              className={cn(iconBtn, "-mr-2 lg:mr-0")}
              onClick={openDrawer}
              aria-label={count > 0 ? `Open cart, ${count} item${count === 1 ? "" : "s"}` : "Open cart"}
              data-testid="cart-button"
            >
              <ShoppingBag className="size-[1.15rem]" aria-hidden="true" />
              {count > 0 ? (
                <span
                  key={count}
                  className="absolute right-1 top-1 grid min-w-[1.15rem] animate-fade-in place-items-center rounded-full bg-banana px-1 text-[0.65rem] font-bold leading-[1.15rem] text-forest-deep"
                  aria-hidden="true"
                >
                  {count}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} side="left" title="Menu" labelledBy="mobile-menu-title" className="paper">
        <nav id="mobile-menu" aria-label="Mobile" className="px-5 py-6">
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive(pathname, link.href) ? "page" : undefined}
                  className="block rounded-xl px-3 py-3 font-display text-[1.5rem] text-forest transition-colors hover:bg-forest/[0.05] aria-[current=page]:bg-forest/[0.06]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-2 border-t border-line pt-6">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setSearchOpen(true);
              }}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[0.95rem] text-graphite hover:bg-forest/[0.05]"
            >
              <Search className="size-4 text-forest" aria-hidden="true" /> Search products
            </button>
            <Link href="/account" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-[0.95rem] text-graphite hover:bg-forest/[0.05]">
              <User className="size-4 text-forest" aria-hidden="true" /> My account
            </Link>
            <Link href="/track-order" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-[0.95rem] text-graphite hover:bg-forest/[0.05]">
              <ShoppingBag className="size-4 text-forest" aria-hidden="true" /> Track an order
            </Link>
          </div>
          {contact.email || contact.phone ? (
            <div className="mt-6 rounded-2xl bg-cream-deep/60 p-4 text-[0.85rem] text-muted">
              <p className="font-semibold text-forest">Need help?</p>
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="mt-1 block hover:text-forest">
                  {contact.email}
                </a>
              ) : null}
              {contact.phone ? (
                <a href={`tel:+91${contact.phone}`} className="block hover:text-forest">
                  +91 {contact.phone}
                </a>
              ) : null}
            </div>
          ) : null}
        </nav>
      </Sheet>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} index={searchIndex} />
    </>
  );
}

function SearchDialog({ open, onClose, index }: { open: boolean; onClose: () => void; index: SearchItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return index;
    return index.filter((item) => `${item.title} ${item.subtitle ?? ""}`.toLowerCase().includes(q));
  }, [query, index]);

  return (
    <Sheet open={open} onClose={onClose} side="center" title="Search" labelledBy="search-title">
      <form
        role="search"
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onClose();
          router.push(query.trim() ? `/shop?q=${encodeURIComponent(query.trim())}` : "/shop");
        }}
      >
        <label htmlFor="site-search" className="sr-only">
          Search products
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="site-search"
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Banana Chewy…"
            className="h-13 w-full rounded-full border border-line bg-cream pl-11 pr-4 text-[1rem] focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15"
          />
        </div>
        <ul className="mt-4 divide-y divide-line" aria-label="Matching products">
          {results.length === 0 ? (
            <li className="py-6 text-center text-[0.92rem] text-muted">No products match “{query}”.</li>
          ) : (
            results.map((item) => (
              <li key={item.slug}>
                <Link href={`/products/${item.slug}`} onClick={onClose} className="flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-forest/[0.04]">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-cream-deep">
                    {item.imageUrl ? <Image src={item.imageUrl} alt={item.imageAlt} fill sizes="56px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.95rem] font-semibold text-forest">{item.title}</span>
                    {item.subtitle ? <span className="block truncate text-[0.82rem] text-muted">{item.subtitle}</span> : null}
                  </span>
                  {item.pricePaise !== null ? <span className="text-[0.9rem] font-semibold tabular-nums">{formatINR(item.pricePaise)}</span> : null}
                </Link>
              </li>
            ))
          )}
        </ul>
      </form>
    </Sheet>
  );
}

export function AnnouncementBar({ title, ctaLabel, ctaUrl }: { title: string; ctaLabel: string | null; ctaUrl: string | null }) {
  return (
    <div className="bg-forest text-cream">
      <div className="container-site flex min-h-10 flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-[0.78rem] tracking-[0.03em]">
        <p>{title}</p>
        {ctaLabel && ctaUrl ? (
          <Link href={ctaUrl} className="font-semibold underline decoration-banana underline-offset-4 hover:text-banana-soft">
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function PreviewBanner() {
  return (
    <div className="bg-banana text-forest-deep">
      <div className="container-site flex flex-wrap items-center justify-center gap-3 py-2 text-[0.8rem] font-semibold">
        <span>Preview mode — you are seeing unpublished drafts.</span>
        <form action="/api/preview/exit" method="post">
          <button className="rounded-full bg-forest px-3 py-1 text-cream hover:bg-forest-deep">Exit preview</button>
        </form>
      </div>
    </div>
  );
}

export function NoImage({ className }: { className?: string }) {
  return (
    <div className={cn("grid size-full place-items-center bg-cream-deep text-sage", className)}>
      <Image src="/brand/unar-logo-transparent.webp" alt="" width={120} height={38} className="opacity-40" />
    </div>
  );
}
