import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-xl border border-line bg-paper px-4 py-3 text-[0.95rem] text-graphite placeholder:text-muted/70 transition-colors duration-200 hover:border-sage focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/10 disabled:bg-cream-deep disabled:text-muted";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-[0.82rem] font-semibold text-graphite", className)} {...props} />;
}

export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-[0.8rem] font-medium text-danger" role="alert">
      {message}
    </p>
  );
}

export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-[0.78rem] leading-relaxed text-muted">
      {children}
    </p>
  );
}

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, "h-12", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(control, "min-h-28 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        control,
        "h-12 appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1.5l5 5 5-5' stroke='%232E4E36' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")] bg-[length:12px_8px] bg-[right_1rem_center] bg-no-repeat pr-10",
        className,
      )}
      {...props}
    />
  );
});

export function Checkbox({
  label,
  description,
  className,
  ...props
}: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={props.id ?? id}
        type="checkbox"
        className="mt-0.5 size-[1.15rem] shrink-0 rounded-[5px] border-line accent-[var(--color-forest)]"
        {...props}
      />
      <label htmlFor={props.id ?? id} className="text-[0.88rem] leading-snug text-graphite">
        {label}
        {description ? <span className="mt-0.5 block text-[0.78rem] text-muted">{description}</span> : null}
      </label>
    </div>
  );
}

/** Label + control + error wiring with correct aria attributes. */
export function Field({
  label,
  error,
  hint,
  children,
  className,
  required,
  htmlFor,
}: {
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  required?: boolean;
  htmlFor: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-danger" aria-hidden="true">*</span> : null}
      </Label>
      {children}
      {hint && !error ? <FieldHint id={`${htmlFor}-hint`}>{hint}</FieldHint> : null}
      <FieldError id={`${htmlFor}-error`} message={error} />
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-4 py-3 text-[0.88rem] leading-relaxed",
        tone === "error" && "border-danger/25 bg-danger-soft text-danger",
        tone === "success" && "border-success/25 bg-success-soft text-success",
        tone === "info" && "border-sage bg-sage-soft text-forest",
      )}
    >
      {children}
    </div>
  );
}
