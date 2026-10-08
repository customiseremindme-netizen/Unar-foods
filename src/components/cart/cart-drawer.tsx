"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { ButtonLink } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity";
import { formatINR } from "@/lib/money";
import { useCart } from "./cart-context";

export function CartDrawer() {
  const { state, drawerOpen, closeDrawer, update, pending } = useCart();
  const cart = state?.cart;
  const summary = state?.summary;
  const hasProblems = cart?.lines.some((l) => l.problem) ?? false;

  return (
    <Sheet
      open={drawerOpen}
      onClose={closeDrawer}
      labelledBy="cart-drawer-title"
      title={
        <span>
          Your cart{" "}
          {cart && cart.itemCount > 0 ? <span className="font-sans text-[0.9rem] text-muted">({cart.itemCount})</span> : null}
        </span>
      }
      footer={
        cart && cart.lines.length > 0 ? (
          <div className="space-y-3">
            <dl className="space-y-1.5 text-[0.9rem]">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-semibold tabular-nums">{formatINR(cart.subtotalPaise)}</dd>
              </div>
              {summary && summary.discountPaise > 0 ? (
                <div className="flex justify-between text-success">
                  <dt>Coupon {summary.couponCode}</dt>
                  <dd className="tabular-nums">−{formatINR(summary.discountPaise)}</dd>
                </div>
              ) : null}
              <p className="text-[0.78rem] text-muted">Shipping is calculated at checkout from your PIN code.</p>
            </dl>
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink href="/cart" variant="secondary" onClick={closeDrawer}>
                View cart
              </ButtonLink>
              <ButtonLink
                href="/checkout"
                onClick={closeDrawer}
                aria-disabled={hasProblems}
                className={hasProblems ? "pointer-events-none opacity-55" : undefined}
              >
                Checkout
              </ButtonLink>
            </div>
            {hasProblems ? (
              <p className="text-[0.78rem] text-danger" role="alert">
                Please fix the highlighted items before checking out.
              </p>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {!cart || cart.lines.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-8 py-16 text-center">
          <ShoppingBag className="mb-4 size-10 text-sage" strokeWidth={1.2} aria-hidden="true" />
          <p className="font-display text-[1.4rem] text-forest">Your cart is empty</p>
          <p className="mt-2 text-[0.92rem] text-muted">One healthy habit a day starts here.</p>
          <ButtonLink href="/shop" className="mt-6" onClick={closeDrawer}>
            Shop Banana Chewy
          </ButtonLink>
        </div>
      ) : (
        <ul className="divide-y divide-line px-5" aria-busy={pending}>
          {cart.lines.map((line) => (
            <li key={line.variantId} className="flex gap-4 py-5">
              <Link
                href={`/products/${line.productSlug}`}
                onClick={closeDrawer}
                className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-cream-deep"
              >
                {line.imageUrl ? (
                  <Image src={line.imageUrl} alt={line.imageAlt} fill sizes="80px" className="object-cover" />
                ) : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/products/${line.productSlug}`}
                  onClick={closeDrawer}
                  className="line-clamp-2 text-[0.92rem] font-semibold leading-snug text-forest hover:underline"
                >
                  {line.shortTitle}
                </Link>
                <p className="mt-0.5 text-[0.8rem] text-muted">
                  {line.variantTitle} · {formatINR(line.unitPricePaise)}
                </p>
                {line.problem ? (
                  <p className="mt-1 text-[0.78rem] font-semibold text-danger" role="alert">
                    {line.problem}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <QuantityStepper
                    size="sm"
                    value={line.quantity}
                    min={1}
                    max={Math.max(line.maxQuantity, 1)}
                    disabled={pending || !line.available || line.maxQuantity === 0}
                    onChange={(q) => update(line.variantId, q)}
                    label={`Quantity of ${line.shortTitle}`}
                  />
                  <button
                    type="button"
                    onClick={() => update(line.variantId, 0)}
                    disabled={pending}
                    className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                    aria-label={`Remove ${line.shortTitle}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <p className="shrink-0 text-[0.92rem] font-semibold tabular-nums text-graphite">{formatINR(line.lineTotalPaise)}</p>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
