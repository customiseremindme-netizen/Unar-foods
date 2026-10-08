"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingBag } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity";
import { useCart } from "@/components/cart/cart-context";
import { cn } from "@/lib/utils";

export function AddToCartButton({
  variantId,
  disabled,
  disabledLabel = "Sold out",
  quantity = 1,
  size = "md",
  className,
  label = "Add to cart",
  productName,
}: {
  variantId: string | null;
  disabled?: boolean;
  disabledLabel?: string;
  quantity?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
  productName: string;
}) {
  const { add, pending } = useCart();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!variantId || disabled) {
    return (
      <Button size={size} variant="secondary" disabled className={className}>
        {disabledLabel}
      </Button>
    );
  }

  return (
    <Button
      size={size}
      className={cn("overflow-hidden", className)}
      loading={busy}
      disabled={pending && !busy}
      aria-label={`${label}: ${productName}`}
      onClick={async () => {
        setBusy(true);
        const ok = await add(variantId, quantity);
        setBusy(false);
        if (ok) {
          setAdded(true);
          window.setTimeout(() => setAdded(false), 1800);
        }
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {added ? (
          <m.span
            key="added"
            className="inline-flex items-center gap-2"
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Check className="size-4" aria-hidden="true" /> Added
          </m.span>
        ) : (
          <m.span
            key="add"
            className="inline-flex items-center gap-2"
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {!busy ? <ShoppingBag className="size-4" aria-hidden="true" /> : null}
            {label}
          </m.span>
        )}
      </AnimatePresence>
    </Button>
  );
}

/** Quantity + Add to cart + Buy now, used on the product page. */
export function BuyBox({
  variantId,
  maxQuantity,
  productName,
  soldOut,
}: {
  variantId: string | null;
  maxQuantity: number;
  productName: string;
  soldOut: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const { add, pending } = useCart();
  const router = useRouter();
  const [buying, setBuying] = useState(false);

  if (!variantId || soldOut || maxQuantity < 1) {
    return (
      <div className="space-y-3">
        <Button size="lg" variant="secondary" disabled className="w-full">
          Sold out
        </Button>
        <p className="text-[0.85rem] text-muted">This product is currently out of stock. Please check back soon.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantity} min={1} max={maxQuantity} onChange={setQuantity} label="Quantity" />
        <AddToCartButton variantId={variantId} quantity={quantity} size="lg" className="flex-1" productName={productName} />
      </div>
      <Button
        size="lg"
        variant="accent"
        className="w-full"
        loading={buying}
        disabled={pending && !buying}
        onClick={async () => {
          setBuying(true);
          const ok = await add(variantId, quantity, { openDrawer: false });
          if (ok) router.push("/checkout");
          else setBuying(false);
        }}
      >
        Buy now
      </Button>
    </div>
  );
}
