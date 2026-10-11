import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "accent" | "danger" | "link";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-[var(--store-button-radius,9999px)] font-semibold tracking-[0.01em] transition-[background-color,color,box-shadow,transform,border-color] duration-300 ease-[var(--ease-leaf)] disabled:opacity-55 disabled:pointer-events-none select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-forest text-cream hover:bg-forest-deep shadow-[0_10px_24px_-14px_rgb(46_78_54/0.6)] hover:shadow-[0_14px_30px_-14px_rgb(46_78_54/0.7)] active:scale-[0.98]",
  secondary:
    "border border-forest/35 text-forest bg-transparent hover:border-forest hover:bg-forest/[0.04] active:scale-[0.98]",
  ghost: "text-forest hover:bg-forest/[0.06]",
  accent: "bg-banana text-forest-deep hover:brightness-[1.04] active:scale-[0.98] shadow-[0_10px_24px_-16px_rgb(120_90_10/0.55)]",
  danger: "bg-danger text-white hover:brightness-110 active:scale-[0.98]",
  link: "text-forest underline underline-offset-4 decoration-1 hover:decoration-2 rounded-md px-0",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[0.8rem]",
  md: "h-11 px-6 text-[0.875rem]",
  lg: "h-13 px-8 text-[0.95rem]",
};

export type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], variant !== "link" && sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
});

export type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ className, variant = "primary", size = "md", ...props }: ButtonLinkProps) {
  return <Link className={cn(base, variants[variant], variant !== "link" && sizes[size], className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
