"use client";

import { useActionState } from "react";
import { ExternalLink } from "lucide-react";
import { trackOrderAction, type TrackResult } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { formatDateTime, titleCase } from "@/lib/utils";

export function TrackOrderForm({ initialOrder }: { initialOrder: string }) {
  const [state, action, pending] = useActionState<TrackResult | null, FormData>(trackOrderAction, null);

  return (
    <div className="space-y-8">
      <form action={action} className="grid gap-4 rounded-[2rem] border border-line bg-paper p-6 sm:grid-cols-2 sm:p-8">
        <Field label="Order number" htmlFor="order_number" required>
          <Input id="order_number" name="order_number" defaultValue={initialOrder} placeholder="UNAR-001001" autoComplete="off" required />
        </Field>
        <Field label="Email or mobile used at checkout" htmlFor="contact" required>
          <Input id="contact" name="contact" autoComplete="email" required />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" loading={pending}>
            Track order
          </Button>
        </div>
        {state && !state.ok ? (
          <div className="sm:col-span-2">
            <FormMessage tone="error">{state.message}</FormMessage>
          </div>
        ) : null}
      </form>

      {state?.ok ? (
        <section aria-live="polite" className="rounded-[2rem] border border-line bg-paper p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[1.6rem]">{state.order.orderNumber}</h2>
            <Badge tone={state.order.statusTone}>{state.order.statusLabel}</Badge>
          </div>
          <p className="mt-1 text-[0.85rem] text-muted">Placed {formatDateTime(state.order.placedAt)}</p>
          <ul className="mt-5 space-y-1 text-[0.92rem]">
            {state.order.items.map((i) => (
              <li key={`${i.title}-${i.variant}`}>
                {i.title} {i.variant ? `(${i.variant})` : ""} × {i.quantity}
              </li>
            ))}
          </ul>
          {state.order.shipments.map((s, idx) => (
            <div key={idx} className="mt-5 rounded-2xl bg-cream/60 p-4 text-[0.9rem]">
              <p className="font-semibold text-forest">
                {s.carrier ?? "Courier"} {s.trackingNumber ? `· ${s.trackingNumber}` : ""} · {titleCase(s.status)}
              </p>
              {s.trackingUrl ? (
                <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-forest underline">
                  Track on courier website <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          ))}
          {state.order.events.length > 0 ? (
            <ol className="mt-6 space-y-3 border-l border-line pl-5 text-[0.9rem]">
              {state.order.events.map((e, idx) => (
                <li key={idx}>
                  <p>{e.message}</p>
                  <p className="text-[0.78rem] text-muted">{formatDateTime(e.at)}</p>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
