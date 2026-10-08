"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled,
  label = "Quantity",
  size = "md",
  className,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const btn = cn(
    "grid place-items-center text-forest transition-colors hover:bg-forest/[0.06] disabled:opacity-35 disabled:hover:bg-transparent",
    size === "sm" ? "size-8" : "size-11",
  );
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex items-center overflow-hidden rounded-full border border-line bg-paper", className)}
    >
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <Minus className="size-3.5" aria-hidden="true" />
      </button>
      <output aria-live="polite" className={cn("min-w-8 text-center font-semibold tabular-nums", size === "sm" ? "text-[0.85rem]" : "text-[0.95rem]")}>
        {value}
      </output>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
