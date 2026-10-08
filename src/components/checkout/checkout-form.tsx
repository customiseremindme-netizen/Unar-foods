"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { CreditCard, Lock, Tag, Truck, Wallet } from "lucide-react";
import {
  cancelPendingOrderAction,
  placeOrderAction,
  quoteCheckoutAction,
  resumePaymentAction,
  type QuoteSummary,
  type RazorpayCheckoutOptions,
} from "@/app/actions/checkout";
import { useCart } from "@/components/cart/cart-context";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { INDIAN_STATES } from "@/lib/validation/common";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { payWithRazorpay } from "./razorpay";

export type SavedAddress = {
  id: string;
  label: string | null;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
};

type AddressForm = { full_name: string; phone: string; line1: string; line2: string; landmark: string; city: string; state: string; pincode: string };

const emptyAddress: AddressForm = { full_name: "", phone: "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "" };

function fromSaved(a: SavedAddress): AddressForm {
  return {
    full_name: a.full_name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? "",
    landmark: a.landmark ?? "",
    city: a.city,
    state: a.state,
    pincode: a.pincode,
  };
}

function AddressFields({
  prefix,
  value,
  onChange,
  errors,
}: {
  prefix: "shipping" | "billing";
  value: AddressForm;
  onChange: (v: AddressForm) => void;
  errors: Record<string, string>;
}) {
  const set = (key: keyof AddressForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [key]: e.target.value });
  const err = (key: string) => errors[`${prefix}.${key}`];
  const id = (key: string) => `${prefix}-${key}`;
  const aria = (key: string) => ({ "aria-invalid": !!err(key), "aria-describedby": err(key) ? `${id(key)}-error` : undefined });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" htmlFor={id("full_name")} required error={err("full_name")} className="sm:col-span-2">
        <Input id={id("full_name")} value={value.full_name} onChange={set("full_name")} autoComplete={`${prefix} name`} {...aria("full_name")} />
      </Field>
      <Field label="Mobile number" htmlFor={id("phone")} required error={err("phone")} hint="10-digit number for delivery updates">
        <Input id={id("phone")} value={value.phone} onChange={set("phone")} inputMode="tel" autoComplete={`${prefix} tel-national`} {...aria("phone")} />
      </Field>
      <Field label="PIN code" htmlFor={id("pincode")} required error={err("pincode")}>
        <Input
          id={id("pincode")}
          value={value.pincode}
          onChange={(e) => onChange({ ...value, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
          inputMode="numeric"
          autoComplete={`${prefix} postal-code`}
          {...aria("pincode")}
        />
      </Field>
      <Field label="House / flat, building, street" htmlFor={id("line1")} required error={err("line1")} className="sm:col-span-2">
        <Input id={id("line1")} value={value.line1} onChange={set("line1")} autoComplete={`${prefix} address-line1`} {...aria("line1")} />
      </Field>
      <Field label="Area, locality (optional)" htmlFor={id("line2")} error={err("line2")}>
        <Input id={id("line2")} value={value.line2} onChange={set("line2")} autoComplete={`${prefix} address-line2`} />
      </Field>
      <Field label="Landmark (optional)" htmlFor={id("landmark")} error={err("landmark")}>
        <Input id={id("landmark")} value={value.landmark} onChange={set("landmark")} />
      </Field>
      <Field label="City / town" htmlFor={id("city")} required error={err("city")}>
        <Input id={id("city")} value={value.city} onChange={set("city")} autoComplete={`${prefix} address-level2`} {...aria("city")} />
      </Field>
      <Field label="State" htmlFor={id("state")} required error={err("state")}>
        <Select id={id("state")} value={value.state} onChange={set("state")} autoComplete={`${prefix} address-level1`} {...aria("state")}>
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function CouponBox() {
  const { state, applyCoupon, removeCoupon, pending } = useCart();
  const [code, setCode] = useState("");
  const applied = state?.summary.couponCode;
  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-success-soft px-4 py-3 text-[0.85rem] text-success">
        <span className="inline-flex items-center gap-2">
          <Tag className="size-4" aria-hidden="true" /> Coupon <strong>{applied}</strong> applied
        </span>
        <button type="button" onClick={() => removeCoupon()} disabled={pending} className="font-semibold underline">
          Remove
        </button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <label htmlFor="coupon" className="sr-only">
        Coupon code
      </label>
      <Input
        id="coupon"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Coupon code"
        className="h-11"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (code.trim()) void applyCoupon(code).then((ok) => ok && setCode(""));
          }
        }}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={!code.trim() || pending}
        onClick={() => void applyCoupon(code).then((ok) => ok && setCode(""))}
      >
        Apply
      </Button>
    </div>
  );
}

export function CheckoutForm({
  initialEmail,
  initialPhone,
  initialName,
  savedAddresses,
  signedIn,
  onlineAvailable,
  codEnabled,
  newsletterConsentText,
  themeColor,
  pricesIncludeTax,
}: {
  initialEmail: string;
  initialPhone: string;
  initialName: string;
  savedAddresses: SavedAddress[];
  signedIn: boolean;
  onlineAvailable: boolean;
  codEnabled: boolean;
  newsletterConsentText: string;
  themeColor: string;
  pricesIncludeTax: boolean;
}) {
  const router = useRouter();
  const { state: cartState, refresh } = useCart();
  const defaultAddress = savedAddresses.find((a) => a.is_default) ?? savedAddresses[0];

  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [selectedAddress, setSelectedAddress] = useState<string>(defaultAddress?.id ?? "new");
  const [shipping, setShipping] = useState<AddressForm>(
    defaultAddress ? fromSaved(defaultAddress) : { ...emptyAddress, full_name: initialName, phone: initialPhone },
  );
  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState<AddressForm>(emptyAddress);
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "cod">(onlineAvailable ? "razorpay" : "cod");
  const [note, setNote] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saveAddress, setSaveAddress] = useState(savedAddresses.length === 0);
  const [recovery, setRecovery] = useState(false);
  const [website, setWebsite] = useState("");

  const [quote, setQuote] = useState<QuoteSummary | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [pendingPayment, setPendingPayment] = useState<RazorpayCheckoutOptions | null>(null);
  const [paymentNote, setPaymentNote] = useState<string | null>(null);

  const couponKey = cartState?.summary.couponCode ?? "";
  const itemsKey = cartState?.cart.lines.map((l) => `${l.variantId}:${l.quantity}`).join(",") ?? "";

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setQuoting(true);
      const result = await quoteCheckoutAction({ pincode: shipping.pincode, state: shipping.state, paymentMethod, email });
      if (!cancelled) {
        setQuote(result);
        setQuoting(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [shipping.pincode, shipping.state, paymentMethod, email, couponKey, itemsKey]);

  useEffect(() => {
    const onFail = (e: Event) => setPaymentNote((e as CustomEvent<string>).detail);
    window.addEventListener("unar:payment-failed", onFail);
    return () => window.removeEventListener("unar:payment-failed", onFail);
  }, []);

  useEffect(() => {
    if (quote && paymentMethod === "cod" && !quote.codAvailable && quote.shipping.status === "ok" && onlineAvailable) {
      setPaymentMethod("razorpay");
    }
  }, [quote, paymentMethod, onlineAvailable]);

  const lines = cartState?.cart.lines ?? [];
  const showCod = codEnabled && (quote ? quote.codAvailable || quote.shipping.status !== "ok" : true);

  const payload = useMemo(
    () => ({
      email,
      phone,
      shipping,
      billing_same: billingSame,
      billing: billingSame ? undefined : billing,
      payment_method: paymentMethod,
      customer_note: note,
      terms,
      marketing_consent: marketing,
      save_address: signedIn && selectedAddress === "new" && saveAddress,
      recovery_consent: recovery,
      website,
    }),
    [email, phone, shipping, billingSame, billing, paymentMethod, note, terms, marketing, signedIn, selectedAddress, saveAddress, recovery, website],
  );

  async function startPayment(options: RazorpayCheckoutOptions) {
    setPaymentNote(null);
    const result = await payWithRazorpay(options, themeColor);
    if (result.outcome === "verified") {
      await refresh();
      router.push(result.verify.redirectTo);
      return;
    }
    if (result.outcome === "unavailable") {
      setPendingPayment(options);
      setMessage("We couldn't load the secure payment window. Check your connection and press “Pay now” again.");
      return;
    }
    setPendingPayment(options);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setErrors({});
    startSubmit(async () => {
      const result = await placeOrderAction(payload);
      if (!result.ok) {
        setErrors(result.errors ?? {});
        setMessage(result.message);
        const first = Object.keys(result.errors ?? {})[0];
        if (first) document.getElementById(first.replace(".", "-"))?.focus();
        else window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (result.kind === "cod") {
        await refresh();
        router.push(result.redirectTo);
        return;
      }
      await startPayment(result.razorpay);
    });
  }

  if (pendingPayment) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-line bg-paper p-8 text-center">
        <h2 className="text-[1.8rem]">Payment not completed</h2>
        <p className="mt-3 text-muted">
          Your order <strong className="text-forest">{pendingPayment.orderNumber}</strong> is reserved for a short time. You have not been
          charged.
        </p>
        {paymentNote ? <p className="mt-3 text-[0.9rem] text-danger">Last attempt: {paymentNote}</p> : null}
        {message ? <div className="mt-4"><FormMessage tone="error">{message}</FormMessage></div> : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            onClick={async () => {
              setMessage(null);
              const fresh = await resumePaymentAction(pendingPayment.orderNumber, pendingPayment.accessToken);
              if (fresh.ok && fresh.kind === "razorpay") await startPayment(fresh.razorpay);
              else if (!fresh.ok) setMessage(fresh.message);
            }}
          >
            <Lock className="size-4" aria-hidden="true" /> Pay now
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={async () => {
              const r = await cancelPendingOrderAction(pendingPayment.orderNumber, pendingPayment.accessToken);
              if (r.ok) {
                setPendingPayment(null);
                setMessage(r.message);
                await refresh();
              } else {
                router.push(`/orders/${pendingPayment.orderNumber}?token=${encodeURIComponent(pendingPayment.accessToken)}`);
              }
            }}
          >
            Cancel order
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <div className="space-y-10 lg:col-span-7">
        {message ? <FormMessage tone="error">{message}</FormMessage> : null}

        <section aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="text-[1.5rem]">
            Contact
          </h2>
          {!signedIn ? (
            <p className="mt-1 text-[0.85rem] text-muted">
              Have an account?{" "}
              <Link href="/login?next=/checkout" className="font-semibold text-forest underline underline-offset-4">
                Sign in
              </Link>{" "}
              for faster checkout and order history.
            </p>
          ) : null}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="email" required error={errors.email} hint="Order updates are sent here">
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!errors.email} />
            </Field>
            <Field label="Mobile number" htmlFor="phone" required error={errors.phone}>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" aria-invalid={!!errors.phone} />
            </Field>
          </div>
          <Checkbox
            className="mt-4"
            checked={recovery}
            onChange={(e) => setRecovery(e.target.checked)}
            label="Email me a reminder if I don't finish my order (optional)"
          />
        </section>

        <section aria-labelledby="shipping-heading">
          <h2 id="shipping-heading" className="text-[1.5rem]">
            Delivery address
          </h2>
          {savedAddresses.length > 0 ? (
            <fieldset className="mt-5 grid gap-3">
              <legend className="sr-only">Choose a saved address</legend>
              {savedAddresses.map((a) => (
                <label
                  key={a.id}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-2xl border bg-paper p-4 text-[0.9rem] transition-colors",
                    selectedAddress === a.id ? "border-forest ring-2 ring-forest/10" : "border-line hover:border-sage",
                  )}
                >
                  <input
                    type="radio"
                    name="saved-address"
                    checked={selectedAddress === a.id}
                    onChange={() => {
                      setSelectedAddress(a.id);
                      setShipping(fromSaved(a));
                    }}
                    className="mt-1 accent-[var(--color-forest)]"
                  />
                  <span>
                    <span className="font-semibold text-forest">{a.label || a.full_name}</span>
                    <span className="block text-muted">
                      {[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                    </span>
                  </span>
                </label>
              ))}
              <label
                className={cn(
                  "flex cursor-pointer gap-3 rounded-2xl border bg-paper p-4 text-[0.9rem]",
                  selectedAddress === "new" ? "border-forest ring-2 ring-forest/10" : "border-line hover:border-sage",
                )}
              >
                <input
                  type="radio"
                  name="saved-address"
                  checked={selectedAddress === "new"}
                  onChange={() => {
                    setSelectedAddress("new");
                    setShipping({ ...emptyAddress, full_name: initialName, phone: initialPhone });
                  }}
                  className="mt-1 accent-[var(--color-forest)]"
                />
                <span className="font-semibold text-forest">Use a new address</span>
              </label>
            </fieldset>
          ) : null}
          {selectedAddress === "new" || savedAddresses.length === 0 ? (
            <div className="mt-5">
              <AddressFields prefix="shipping" value={shipping} onChange={setShipping} errors={errors} />
              {signedIn ? (
                <Checkbox className="mt-4" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} label="Save this address to my account" />
              ) : null}
            </div>
          ) : null}
          <Checkbox className="mt-5" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} label="Billing address is the same as delivery address" />
          {!billingSame ? (
            <div className="mt-5 rounded-2xl border border-line bg-paper p-5">
              <h3 className="mb-4 font-sans text-[0.95rem] font-semibold tracking-normal">Billing address</h3>
              <AddressFields prefix="billing" value={billing} onChange={setBilling} errors={errors} />
            </div>
          ) : null}
        </section>

        <section aria-labelledby="payment-heading">
          <h2 id="payment-heading" className="text-[1.5rem]">
            Payment
          </h2>
          <fieldset className="mt-5 grid gap-3">
            <legend className="sr-only">Payment method</legend>
            {onlineAvailable ? (
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border bg-paper p-4",
                  paymentMethod === "razorpay" ? "border-forest ring-2 ring-forest/10" : "border-line",
                )}
              >
                <input type="radio" name="payment" checked={paymentMethod === "razorpay"} onChange={() => setPaymentMethod("razorpay")} className="mt-1 accent-[var(--color-forest)]" />
                <span>
                  <span className="flex items-center gap-2 font-semibold text-forest">
                    <CreditCard className="size-4" aria-hidden="true" /> Pay online
                  </span>
                  <span className="block text-[0.85rem] text-muted">
                    Secure payment by Razorpay. The available options (such as UPI, cards or netbanking) are shown in the payment window.
                  </span>
                </span>
              </label>
            ) : null}
            {showCod ? (
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border bg-paper p-4",
                  paymentMethod === "cod" ? "border-forest ring-2 ring-forest/10" : "border-line",
                )}
              >
                <input type="radio" name="payment" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} className="mt-1 accent-[var(--color-forest)]" />
                <span>
                  <span className="flex items-center gap-2 font-semibold text-forest">
                    <Wallet className="size-4" aria-hidden="true" /> Cash on Delivery
                  </span>
                  <span className="block text-[0.85rem] text-muted">Pay when your order arrives (where available).</span>
                </span>
              </label>
            ) : null}
            {!onlineAvailable && !codEnabled ? (
              <FormMessage tone="info">Ordering will open soon — payments are not set up yet.</FormMessage>
            ) : null}
          </fieldset>
        </section>

        <section aria-labelledby="extras-heading" className="space-y-4">
          <h2 id="extras-heading" className="sr-only">
            Order notes and consent
          </h2>
          <Field label="Order note (optional)" htmlFor="customer_note" error={errors.customer_note}>
            <Textarea id="customer_note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Checkbox checked={marketing} onChange={(e) => setMarketing(e.target.checked)} label={newsletterConsentText} />
          <div>
            <Checkbox
              id="terms"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              aria-invalid={!!errors.terms}
              label={
                <>
                  I agree to the{" "}
                  <Link href="/policies/terms" target="_blank" className="font-semibold text-forest underline">
                    Terms
                  </Link>
                  ,{" "}
                  <Link href="/policies/refund-policy" target="_blank" className="font-semibold text-forest underline">
                    Refund policy
                  </Link>{" "}
                  and{" "}
                  <Link href="/policies/privacy-policy" target="_blank" className="font-semibold text-forest underline">
                    Privacy policy
                  </Link>
                  .
                </>
              }
            />
            {errors.terms ? (
              <p className="mt-1.5 text-[0.8rem] font-medium text-danger" role="alert">
                {errors.terms}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <aside className="lg:col-span-5" aria-labelledby="summary-heading">
        <div className="rounded-[2rem] border border-line bg-paper p-6 lg:sticky lg:top-28">
          <h2 id="summary-heading" className="text-[1.5rem]">
            Order summary
          </h2>
          <ul className="mt-5 divide-y divide-line">
            {lines.map((line) => (
              <li key={line.variantId} className="flex items-center gap-4 py-4">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-cream-deep">
                  {line.imageUrl ? <Image src={line.imageUrl} alt="" fill sizes="64px" className="object-cover" /> : null}
                  <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-forest text-[0.65rem] font-bold text-cream">
                    {line.quantity}
                  </span>
                </span>
                <span className="min-w-0 flex-1 text-[0.88rem]">
                  <span className="block font-semibold text-forest">{line.shortTitle}</span>
                  <span className="text-muted">{line.variantTitle}</span>
                  {line.problem ? <span className="block text-danger">{line.problem}</span> : null}
                </span>
                <span className="text-[0.9rem] font-semibold tabular-nums">{formatINR(line.lineTotalPaise)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <CouponBox />
          </div>
          <dl className="mt-6 space-y-2.5 text-[0.9rem]" aria-busy={quoting}>
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatINR(quote?.subtotalPaise ?? cartState?.cart.subtotalPaise ?? 0)}</dd>
            </div>
            {quote && quote.discountPaise > 0 ? (
              <div className="flex justify-between text-success">
                <dt>Discount {quote.couponCode ? `(${quote.couponCode})` : ""}</dt>
                <dd className="tabular-nums">−{formatINR(quote.discountPaise)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="flex items-center gap-1.5 text-muted">
                <Truck className="size-3.5" aria-hidden="true" /> Shipping
              </dt>
              <dd className="tabular-nums">
                {!quote || quote.shipping.status === "pending_address"
                  ? "Enter PIN code & state"
                  : quote.shipping.status === "ok"
                    ? quote.shippingPaise === 0
                      ? "Free"
                      : formatINR(quote.shippingPaise)
                    : "Not available"}
              </dd>
            </div>
            {quote?.shipping.status === "ok" && quote.shipping.deliveryEstimate ? (
              <p className="text-[0.78rem] text-muted">Estimated delivery: {quote.shipping.deliveryEstimate}</p>
            ) : null}
            {quote && quote.codFeePaise > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">Cash on Delivery fee</dt>
                <dd className="tabular-nums">{formatINR(quote.codFeePaise)}</dd>
              </div>
            ) : null}
            {quote?.taxBreakdown.configured && !pricesIncludeTax ? (
              <div className="flex justify-between">
                <dt className="text-muted">GST</dt>
                <dd className="tabular-nums">{formatINR(quote.taxPaise)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-line pt-4">
              <dt className="font-semibold text-forest">Total</dt>
              <dd className="font-display text-[1.7rem] text-forest tabular-nums" data-testid="checkout-total">
                {formatINR(quote?.totalPaise ?? cartState?.cart.subtotalPaise ?? 0)}
              </dd>
            </div>
            {pricesIncludeTax ? <p className="text-[0.75rem] text-muted">Prices include all applicable taxes.</p> : null}
          </dl>
          {quote && quote.errors.length > 0 && quote.shipping.status !== "pending_address" ? (
            <div className="mt-4">
              <FormMessage tone="error">{quote.errors[0]}</FormMessage>
            </div>
          ) : null}
          <Button type="submit" size="lg" className="mt-6 w-full" loading={submitting} disabled={lines.length === 0 || (!onlineAvailable && !codEnabled)}>
            <Lock className="size-4" aria-hidden="true" />
            {paymentMethod === "cod" ? "Place order" : "Continue to payment"}
          </Button>
          <p className="mt-3 text-center text-[0.75rem] text-muted">
            {paymentMethod === "cod" ? "You'll pay in cash when your order is delivered." : "You'll complete payment securely with Razorpay."}
          </p>
        </div>
      </aside>
    </form>
  );
}
