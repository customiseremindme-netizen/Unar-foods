import Link from "next/link";
import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { discountPercent, formatINR } from "@/lib/money";

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "forest" | "banana" | "danger" | "success" | "sage" | "muted";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em]",
        tone === "neutral" && "bg-cream-deep text-graphite",
        tone === "forest" && "bg-forest text-cream",
        tone === "banana" && "bg-banana-soft text-forest-deep",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "success" && "bg-success-soft text-success",
        tone === "sage" && "bg-sage-soft text-forest",
        tone === "muted" && "bg-paper text-muted ring-1 ring-line",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Price({
  pricePaise,
  mrpPaise,
  className,
  size = "md",
}: {
  pricePaise: number;
  mrpPaise?: number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const off = mrpPaise ? discountPercent(mrpPaise, pricePaise) : 0;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span
        className={cn(
          "font-semibold text-forest tabular-nums",
          size === "sm" && "text-[0.95rem]",
          size === "md" && "text-[1.1rem]",
          size === "lg" && "font-display text-[2rem] font-medium",
        )}
      >
        {formatINR(pricePaise)}
      </span>
      {off > 0 && mrpPaise ? (
        <>
          <span className="text-[0.85rem] text-muted line-through tabular-nums">
            <span className="sr-only">MRP </span>
            {formatINR(mrpPaise)}
          </span>
          <span className="text-[0.75rem] font-semibold text-olive-ink">{off}% off</span>
        </>
      ) : null}
    </span>
  );
}

export function Stars({ rating, className, label }: { rating: number; className?: string; label?: string }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={label ?? `${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={cn("size-4", i <= rounded ? "fill-banana text-banana" : "fill-transparent text-line")}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  as: Tag = "h2",
  className,
  id,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  as?: "h1" | "h2";
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
      <Tag id={id} className={cn(Tag === "h1" ? "text-[2.4rem] sm:text-[3.2rem]" : "text-[2rem] sm:text-[2.6rem]")}>
        {title}
      </Tag>
      {description ? <p className="mt-4 text-[1.02rem] leading-relaxed text-muted">{description}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-3xl border border-dashed border-line bg-paper/60 px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-4 text-sage">{icon}</div> : null}
      <p className="font-display text-[1.4rem] text-forest">{title}</p>
      {description ? <div className="mt-2 max-w-md text-[0.95rem] text-muted">{description}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export type Crumb = { name: string; href?: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-[0.8rem] text-muted", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex items-center gap-1.5">
            {item.href && i < items.length - 1 ? (
              <Link href={item.href} className="link-underline hover:text-forest">
                {item.name}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className="text-graphite">
                {item.name}
              </span>
            )}
            {i < items.length - 1 ? <span aria-hidden="true" className="text-line">/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Indian vegetarian symbol (green square with dot), as printed on the pack. */
export function VegMark({ className, label = "Vegetarian" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[0.8rem] font-medium text-success", className)}>
      <svg viewBox="0 0 20 20" className="size-4" role="img" aria-label={label}>
        <rect x="1" y="1" width="18" height="18" rx="2" fill="none" stroke="#2F6B3E" strokeWidth="1.8" />
        <circle cx="10" cy="10" r="4.5" fill="#2F6B3E" />
      </svg>
      {label}
    </span>
  );
}
