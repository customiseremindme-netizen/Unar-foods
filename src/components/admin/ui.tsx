import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-8">
      {back ? (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-[0.82rem] text-forest hover:underline">
          <ChevronLeft className="size-4" aria-hidden="true" /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.9rem] sm:text-[2.2rem]">{title}</h1>
          {description ? <div className="mt-1.5 max-w-3xl text-[0.9rem] text-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Card({ title, description, actions, children, className }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[1.5rem] border border-line bg-paper p-5 sm:p-6", className)}>
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="font-sans text-[1rem] font-semibold tracking-normal text-forest">{title}</h2> : null}
            {description ? <div className="mt-0.5 text-[0.82rem] text-muted">{description}</div> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "default", href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "warning" | "danger"; href?: string }) {
  const body = (
    <div
      className={cn(
        "h-full rounded-[1.25rem] border bg-paper p-5 transition-colors",
        tone === "default" && "border-line",
        tone === "warning" && "border-banana/60 bg-banana-soft/40",
        tone === "danger" && "border-danger/30 bg-danger-soft/50",
        href && "hover:border-forest",
      )}
    >
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-2 font-display text-[1.9rem] leading-none text-forest tabular-nums">{value}</p>
      {hint ? <p className="mt-2 text-[0.78rem] text-muted">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-[1.25rem] border border-line bg-paper", className)}>
      <table className="w-full min-w-[640px] text-left text-[0.86rem]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("border-b border-line bg-cream/60 px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-muted", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-line/70 px-4 py-3 align-middle", className)}>{children}</td>;
}

export function Pagination({ page, pages, makeHref }: { page: number; pages: number; makeHref: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-[0.85rem]">
      <span className="text-muted">
        Page {page} of {pages}
      </span>
      <span className="flex gap-2">
        {page > 1 ? (
          <Link href={makeHref(page - 1)} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 hover:border-forest">
            <ChevronLeft className="size-4" aria-hidden="true" /> Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={makeHref(page + 1)} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 hover:border-forest">
            Next <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </span>
    </nav>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "note"}
      className={cn(
        "rounded-xl border px-4 py-3 text-[0.86rem] leading-relaxed",
        tone === "info" && "border-sage bg-sage-soft/70 text-forest",
        tone === "warning" && "border-banana/50 bg-banana-soft/60 text-forest-deep",
        tone === "danger" && "border-danger/25 bg-danger-soft text-danger",
        tone === "success" && "border-success/25 bg-success-soft text-success",
      )}
    >
      {children}
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end gap-3 rounded-[1.25rem] border border-line bg-paper p-4">{children}</div>;
}

export const smallInput =
  "h-10 rounded-lg border border-line bg-cream/40 px-3 text-[0.85rem] focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15";
