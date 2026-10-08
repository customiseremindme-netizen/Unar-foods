"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ShoppingBag, Tag, Trash2, Truck } from "lucide-react";
import { estimateShippingAction, type ShippingEstimate } from "@/app/actions/cart";
import { useCart } from "./cart-context";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormMessage, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { QuantityStepper } from "@/components/ui/quantity";
import { INDIAN_STATES } from "@/lib/validation/common";
import { formatINR } from "@/lib/money";

export function CartPageClient() {
  const { state, loading, update, applyCoupon, removeCoupon, pending } = useCart();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [region, setRegion] = useState("");
  const [estimate, setEstimate] = useState<ShippingEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  if (loading && !state) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading your cart">
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
      </div>
    );
  }

  const cart = state?.cart;
  const summary = state?.summary;
  if (!cart || cart.lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-10" strokeWidth={1.2} />}
        title="Your cart is empty"
        description="One healthy habit a day starts here."
        action={<ButtonLink href="/shop">Shop Banana Chewy</ButtonLink>}
      />
    );
  }

  const hasProblems = cart.lines.some((l) => l.problem);

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <section className="lg:col-span-7" aria-label="Cart items">
        <ul className="divide-y divide-line border-y border-line" aria-busy={pending}>
          {cart.lines.map((line) => (
            <li key={line.variantId} className="flex gap-5 py-6">
              <Link href={`/products/${line.productSlug}`} className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-cream-deep sm:size-28">
                {line.imageUrl ? <Image src={line.imageUrl} alt={line.imageAlt} fill sizes="112px" className="object-cover" /> : null}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex justify-between gap-4">
                  <div>
                    <Link href={`/products/${line.productSlug}`} className="font-display text-[1.25rem] leading-snug text-forest hover:underline">
                      {line.shortTitle}
                    </Link>
                    <p className="text-[0.85rem] text-muted">
                      {line.variantTitle} · {formatINR(line.unitPricePaise)} each
                    </p>
                    {line.problem ? (
                      <p className="mt-1 text-[0.82rem] font-semibold text-danger" role="alert">
                        {line.problem}
                      </p>
                    ) : null}
                  </div>
                  <p className="font-semibold tabular-nums">{formatINR(line.lineTotalPaise)}</p>
                </div>
                <div className="mt-auto flex items-center gap-3 pt-4">
                  <QuantityStepper
                    value={line.quantity}
                    min={1}
                    max={Math.max(1, line.maxQuantity)}
                    disabled={pending || !line.available || line.maxQuantity === 0}
                    onChange={(q) => update(line.variantId, q)}
                    label={`Quantity of ${line.shortTitle}`}
                    size="sm"
                  />
                  <button
                    type="button"
                    onClick={() => update(line.variantId, 0)}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.82rem] text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden="true" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/shop" className="link-underline mt-6 inline-block text-[0.9rem] font-semibold text-forest">
          ← Continue shopping
        </Link>
      </section>

      <aside className="lg:col-span-5" aria-labelledby="cart-summary">
        <div className="space-y-6 rounded-[2rem] border border-line bg-paper p-6 lg:sticky lg:top-28">
          <h2 id="cart-summary" className="text-[1.5rem]">
            Summary
          </h2>

          <div>
            <p className="mb-2 flex items-center gap-2 text-[0.85rem] font-semibold">
              <Tag className="size-4 text-olive" aria-hidden="true" /> Coupon
            </p>
            {summary?.couponCode ? (
              <div className="flex items-center justify-between rounded-xl bg-success-soft px-4 py-3 text-[0.85rem] text-success">
                <span>
                  <strong>{summary.couponCode}</strong> applied
                </span>
                <button type="button" onClick={() => removeCoupon()} className="font-semibold underline" disabled={pending}>
                  Remove
                </button>
              </div>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (code.trim() && (await applyCoupon(code))) setCode("");
                }}
              >
                <label htmlFor="cart-coupon" className="sr-only">
                  Coupon code
                </label>
                <Input id="cart-coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter code" className="h-11" />
                <Button type="submit" variant="secondary" disabled={!code.trim() || pending}>
                  Apply
                </Button>
              </form>
            )}
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-[0.85rem] font-semibold">
              <Truck className="size-4 text-olive" aria-hidden="true" /> Estimate shipping
            </p>
            <form
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={async (e) => {
                e.preventDefault();
                setEstimating(true);
                setEstimate(await estimateShippingAction(pin, region));
                setEstimating(false);
              }}
            >
              <label htmlFor="estimate-pin" className="sr-only">
                PIN code
              </label>
              <Input
                id="estimate-pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="PIN code"
                className="h-11"
              />
              <label htmlFor="estimate-state" className="sr-only">
                State
              </label>
              <Select id="estimate-state" value={region} onChange={(e) => setRegion(e.target.value)} className="h-11">
                <option value="">State</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary" loading={estimating}>
                Check
              </Button>
            </form>
            {estimate ? (
              <div className="mt-3" aria-live="polite">
                {estimate.shipping?.status === "ok" ? (
                  <FormMessage tone="info">
                    Shipping: {estimate.shipping.paise === 0 ? "Free" : formatINR(estimate.shipping.paise)}
                    {estimate.shipping.deliveryEstimate ? ` · ${estimate.shipping.deliveryEstimate}` : ""}
                    {estimate.shipping.freeShippingThresholdPaise && estimate.shipping.paise > 0
                      ? ` · Free above ${formatINR(estimate.shipping.freeShippingThresholdPaise)}`
                      : ""}
                  </FormMessage>
                ) : (
                  <FormMessage tone="error">{estimate.message ?? "Shipping isn't available for this location."}</FormMessage>
                )}
              </div>
            ) : null}
          </div>

          <dl className="space-y-2 border-t border-line pt-5 text-[0.92rem]">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal ({cart.itemCount} item{cart.itemCount === 1 ? "" : "s"})</dt>
              <dd className="tabular-nums">{formatINR(cart.subtotalPaise)}</dd>
            </div>
            {summary && summary.discountPaise > 0 ? (
              <div className="flex justify-between text-success">
                <dt>Discount</dt>
                <dd className="tabular-nums">−{formatINR(summary.discountPaise)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted">Shipping</dt>
              <dd className="text-muted">{summary?.freeShipping ? "Free" : "At checkout"}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-semibold text-forest">Estimated total</dt>
              <dd className="font-display text-[1.6rem] text-forest tabular-nums">
                {formatINR(cart.subtotalPaise - (summary?.discountPaise ?? 0))}
              </dd>
            </div>
          </dl>
          <ButtonLink
            href="/checkout"
            size="lg"
            className={hasProblems ? "pointer-events-none w-full opacity-55" : "w-full"}
            aria-disabled={hasProblems}
          >
            Proceed to checkout
          </ButtonLink>
          {hasProblems ? (
            <p className="text-[0.8rem] text-danger" role="alert">
              Please update the highlighted items to continue.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
