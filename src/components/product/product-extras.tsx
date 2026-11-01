"use client";

import { useActionState, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, Link2, MapPin, Share2 } from "lucide-react";
import { checkDeliveryAction, type DeliveryCheck } from "@/app/actions/delivery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Price } from "@/components/ui/misc";
import { WhatsappIcon } from "@/components/brand/icons";
import { AddToCartButton } from "./add-to-cart";
import { cn } from "@/lib/utils";

/** PIN-code delivery check (uses the same shipping zones as checkout). */
export function DeliveryChecker() {
  const [state, action, pending] = useActionState<DeliveryCheck | null, FormData>(checkDeliveryAction, null);
  return (
    <form action={action} className="mt-5 border-t border-line pt-5" noValidate>
      <label htmlFor="pdp-pincode" className="flex items-center gap-2 text-[0.82rem] font-semibold text-graphite">
        <MapPin className="size-4 text-olive" aria-hidden="true" /> Check delivery to your PIN code
      </label>
      <div className="mt-2 flex gap-2">
        <Input id="pdp-pincode" name="pincode" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="postal-code" placeholder="6-digit PIN code" className="h-11" />
        <Button type="submit" variant="secondary" size="md" loading={pending} className="h-11 shrink-0">
          Check
        </Button>
      </div>
      {state ? (
        <div role="status" className={cn("mt-3 text-[0.85rem]", state.ok ? "text-success" : "text-danger")}>
          <p className="font-semibold">{state.message}</p>
          {state.details?.length ? (
            <ul className="mt-1.5 space-y-1 text-muted">
              {state.details.map((d) => (
                <li key={d} className="flex items-center gap-2">
                  <Check className="size-3.5 text-olive" aria-hidden="true" /> {d}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

const noop = () => () => undefined;

/** Share: the phone's own share sheet when available, plus WhatsApp and copy-link. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  // The phone's share sheet exists only in some browsers (never during server rendering).
  const canShare = useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  );
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-[0.8rem] font-semibold text-forest transition-colors hover:border-forest";
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Share this product">
      <span className="text-[0.8rem] text-muted">Share:</span>
      {canShare ? (
        <button type="button" className={btn} onClick={() => navigator.share({ title, url }).catch(() => undefined)}>
          <Share2 className="size-3.5" aria-hidden="true" /> Share
        </button>
      ) : null}
      <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer">
        <WhatsappIcon className="size-3.5" /> WhatsApp
      </a>
      <button
        type="button"
        className={btn}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt("Copy this link:", url);
          }
        }}
      >
        {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Link2 className="size-3.5" aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
      </button>
    </div>
  );
}

/**
 * On phones, keeps price and Add to cart in reach once the main buy box has
 * scrolled out of view. Hidden on large screens.
 */
export function StickyBuyBar({
  targetId,
  variantId,
  soldOut,
  pricePaise,
  mrpPaise,
  productName,
  children,
}: {
  targetId: string;
  variantId: string | null;
  soldOut: boolean;
  pricePaise: number | null;
  mrpPaise: number | null;
  productName: string;
  children?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || !("IntersectionObserver" in window)) return;
    // Show only once the buy box has scrolled above the top of the screen.
    const io = new IntersectionObserver(([entry]) => setVisible(!entry!.isIntersecting && entry!.boundingClientRect.top < 0));
    io.observe(target);
    return () => io.disconnect();
  }, [targetId]);
  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-lift backdrop-blur transition-transform duration-300 ease-[var(--ease-out-soft)] lg:hidden",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8rem] font-semibold text-forest">{productName}</p>
          {pricePaise !== null && mrpPaise !== null ? <Price pricePaise={pricePaise} mrpPaise={mrpPaise} /> : null}
          {children}
        </div>
        <AddToCartButton variantId={variantId} disabled={soldOut} productName={productName} size="md" className="shrink-0" />
      </div>
    </div>
  );
}
