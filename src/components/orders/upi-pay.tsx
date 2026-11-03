"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Smartphone } from "lucide-react";
import { submitUpiReferenceAction } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Label } from "@/components/ui/field";

/**
 * Pay to the shop's own UPI ID: open a UPI app (on a phone) or scan the QR
 * code, then enter the transaction reference so the shop can match the payment.
 * The order is confirmed only after the shop has checked the money arrived.
 */
export function UpiPay({
  orderNumber,
  token,
  link,
  qrSvg,
  upiId,
  payeeName,
  amountLabel,
  reference,
}: {
  orderNumber: string;
  token: string | null;
  link: string;
  qrSvg: string;
  upiId: string;
  payeeName: string;
  amountLabel: string;
  reference: string | null;
}) {
  const router = useRouter();
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (reference) {
    return (
      <div className="mt-4 rounded-2xl bg-paper p-5 text-[0.9rem]">
        <p className="font-semibold text-forest">Thank you — we&apos;re checking your UPI payment.</p>
        <p className="mt-1 text-muted">
          Reference <strong>{reference}</strong>. We&apos;ll confirm your order by email as soon as we see the payment.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-6 rounded-2xl bg-paper p-5 sm:grid-cols-[11rem_1fr]">
      <div className="mx-auto w-44 sm:w-full">
        <div className="overflow-hidden rounded-xl ring-1 ring-line" role="img" aria-label={`UPI QR code to pay ${amountLabel} to ${payeeName}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="mt-2 text-center text-[0.72rem] text-muted">Scan with any UPI app</p>
      </div>
      <div className="space-y-4 text-[0.9rem]">
        <div>
          <p className="font-semibold text-forest">Pay {amountLabel} by UPI</p>
          <p className="text-muted">Google Pay, PhonePe, Paytm or your bank&apos;s UPI app.</p>
        </div>
        <a
          href={link}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-[0.9rem] font-semibold text-cream transition-colors hover:bg-forest-deep"
        >
          <Smartphone className="size-4" aria-hidden="true" /> Open my UPI app
        </a>
        <p className="text-[0.82rem] text-muted">
          Or pay to UPI ID{" "}
          <button
            type="button"
            className="inline-flex items-center gap-1 font-semibold text-forest underline underline-offset-4"
            onClick={async () => {
              await navigator.clipboard?.writeText(upiId).catch(() => undefined);
              setCopied(true);
            }}
          >
            {upiId} {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          </button>{" "}
          ({payeeName}) and write <strong>{orderNumber}</strong> in the note.
        </p>
        <form
          className="space-y-2 border-t border-line pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await submitUpiReferenceAction(orderNumber, token, utr);
            setMessage({ ok: r.ok, text: r.message });
            setBusy(false);
            if (r.ok) router.refresh();
          }}
        >
          <Label htmlFor="upi-utr">After paying: UPI transaction ID (UTR)</Label>
          <div className="flex flex-wrap gap-2">
            <Input id="upi-utr" value={utr} onChange={(e) => setUtr(e.target.value)} inputMode="numeric" placeholder="e.g. 412345678901" className="h-11 max-w-56" autoComplete="off" />
            <Button type="submit" loading={busy} disabled={utr.trim().length < 6} className="h-11">
              I&apos;ve paid
            </Button>
          </div>
          <p className="text-[0.75rem] text-muted">You&apos;ll find it in your UPI app under the payment details (often 12 digits).</p>
          {message ? <FormMessage tone={message.ok ? "success" : "error"}>{message.text}</FormMessage> : null}
        </form>
      </div>
    </div>
  );
}
