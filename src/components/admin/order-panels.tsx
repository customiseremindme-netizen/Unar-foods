"use client";

import { useState } from "react";
import {
  addOrderNoteAction,
  cancelOrderAction,
  clearAttentionAction,
  createShiprocketShipmentAction,
  markCodCollectedAction,
  reconcilePaymentAction,
  refundOrderAction,
  resendEmailAction,
  saveShipmentAction,
  setFulfillmentAction,
  syncShiprocketAction,
} from "@/app/admin/_actions/orders";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/field";
import { paiseToRupeesInput } from "@/lib/money";
import { ActionButton, useAdminAction } from "./forms";

const NEXT_STEPS: Record<string, { status: "processing" | "packed" | "shipped" | "delivered" | "returned"; label: string }[]> = {
  unfulfilled: [
    { status: "processing", label: "Start processing" },
    { status: "packed", label: "Mark packed" },
    { status: "shipped", label: "Mark shipped" },
  ],
  processing: [
    { status: "packed", label: "Mark packed" },
    { status: "shipped", label: "Mark shipped" },
  ],
  packed: [{ status: "shipped", label: "Mark shipped" }],
  shipped: [
    { status: "delivered", label: "Mark delivered" },
    { status: "returned", label: "Mark returned" },
  ],
  delivered: [{ status: "returned", label: "Mark returned" }],
};

export function FulfillmentPanel({ orderId, fulfillment, canWrite }: { orderId: string; fulfillment: string; canWrite: boolean }) {
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState("");
  const { run, pending } = useAdminAction();
  const steps = NEXT_STEPS[fulfillment] ?? [];
  if (!canWrite || steps.length === 0) return null;
  return (
    <div className="space-y-3">
      <Label htmlFor="fulfil-msg">Message for the customer (optional)</Label>
      <Input id="fulfil-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Packed with care and handed to the courier." />
      <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Email the customer when shipped / delivered" />
      <div className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <Button
            key={s.status}
            size="sm"
            variant={s.status === "returned" ? "secondary" : "primary"}
            disabled={pending}
            onClick={() => run(() => setFulfillmentAction({ orderId, status: s.status, message, notifyCustomer: notify }))}
          >
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

type Shipment = { id: string; carrier: string | null; tracking_number: string | null; tracking_url: string | null; status: string; provider: string };

export function ShipmentForm({ orderId, shipment, onDone }: { orderId: string; shipment?: Shipment; onDone?: () => void }) {
  const { run, pending } = useAdminAction();
  const [carrier, setCarrier] = useState(shipment?.carrier ?? "");
  const [tracking, setTracking] = useState(shipment?.tracking_number ?? "");
  const [url, setUrl] = useState(shipment?.tracking_url ?? "");
  const [status, setStatus] = useState(shipment?.status ?? "shipped");
  const [note, setNote] = useState("");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run(() =>
          saveShipmentAction({
            orderId,
            shipmentId: shipment?.id,
            shipment: { carrier, tracking_number: tracking, tracking_url: url, status: status as "shipped" },
            note,
          }),
        );
        if (r.ok) onDone?.();
      }}
    >
      <div>
        <Label htmlFor={`carrier-${shipment?.id ?? "new"}`}>Courier</Label>
        <Input id={`carrier-${shipment?.id ?? "new"}`} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. India Post, DTDC" />
      </div>
      <div>
        <Label htmlFor={`awb-${shipment?.id ?? "new"}`}>Tracking number / AWB</Label>
        <Input id={`awb-${shipment?.id ?? "new"}`} value={tracking} onChange={(e) => setTracking(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`url-${shipment?.id ?? "new"}`}>Tracking link (https://…)</Label>
        <Input id={`url-${shipment?.id ?? "new"}`} value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`status-${shipment?.id ?? "new"}`}>Shipment status</Label>
        <Select id={`status-${shipment?.id ?? "new"}`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {["pending", "packed", "shipped", "in_transit", "out_for_delivery", "delivered", "returned", "cancelled"].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`note-${shipment?.id ?? "new"}`}>Update note (shown to customer)</Label>
        <Input id={`note-${shipment?.id ?? "new"}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" loading={pending}>
          {shipment ? "Update shipment" : "Add shipment"}
        </Button>
      </div>
    </form>
  );
}

export function ShipmentActions({ shipment, orderId, shiprocket }: { shipment: Shipment; orderId: string; shiprocket: boolean }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => setEditing((e) => !e)}>
        {editing ? "Close" : "Edit / add update"}
      </Button>
      {shipment.provider === "shiprocket" && shiprocket ? (
        <ActionButton size="sm" variant="ghost" action={() => syncShiprocketAction(shipment.id)}>
          Sync tracking from Shiprocket
        </ActionButton>
      ) : null}
      {editing ? (
        <div className="mt-3 w-full rounded-xl bg-cream/60 p-4">
          <ShipmentForm orderId={orderId} shipment={shipment} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </div>
  );
}

export function NewShipment({ orderId, shiprocket }: { orderId: string; shiprocket: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Add tracking manually"}
        </Button>
        {shiprocket ? (
          <ActionButton size="sm" variant="ghost" action={() => createShiprocketShipmentAction(orderId)} confirm="Create this order in Shiprocket?">
            Create in Shiprocket
          </ActionButton>
        ) : null}
      </div>
      {open ? <ShipmentForm orderId={orderId} onDone={() => setOpen(false)} /> : null}
    </div>
  );
}

export function NotePanel({ orderId }: { orderId: string }) {
  const [text, setText] = useState("");
  const [customer, setCustomer] = useState(false);
  const { run, pending } = useAdminAction();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run(() => addOrderNoteAction(orderId, text, customer));
        if (r.ok) setText("");
      }}
    >
      <Label htmlFor="order-note">Add a note</Label>
      <Textarea id="order-note" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
      <Checkbox checked={customer} onChange={(e) => setCustomer(e.target.checked)} label="Show this update to the customer on their order page" />
      <Button type="submit" size="sm" loading={pending} disabled={!text.trim()}>
        Add note
      </Button>
    </form>
  );
}

export function RefundPanel({ orderId, remainingPaise, method }: { orderId: string; remainingPaise: number; method: string }) {
  const [amount, setAmount] = useState(paiseToRupeesInput(remainingPaise));
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(false);
  const { run, pending } = useAdminAction();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!window.confirm(`Refund ₹${amount}? This cannot be undone.`)) return;
        await run(() => refundOrderAction({ orderId, amount, reason, restock }));
      }}
    >
      <p className="text-[0.82rem] text-muted">
        {method === "razorpay"
          ? "The refund is sent through Razorpay to the customer's original payment method."
          : "For Cash on Delivery orders, record the refund here after sending the money to the customer yourself."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="refund-amount">Amount (₹)</Label>
          <Input id="refund-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="refund-reason">Reason</Label>
          <Input id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged in transit" />
        </div>
      </div>
      <Checkbox checked={restock} onChange={(e) => setRestock(e.target.checked)} label="Return the items to stock (only if they are sellable)" />
      <Button type="submit" size="sm" variant="danger" loading={pending}>
        Issue refund
      </Button>
    </form>
  );
}

export function CancelPanel({ orderId, paidOnline, canRefund }: { orderId: string; paidOnline: boolean; canRefund: boolean }) {
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [refund, setRefund] = useState(paidOnline && canRefund);
  const { run, pending } = useAdminAction();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!window.confirm("Cancel this order? The customer will be notified.")) return;
        await run(() => cancelOrderAction({ orderId, reason, restock, refund }));
      }}
    >
      <Label htmlFor="cancel-reason">Reason for cancelling</Label>
      <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer requested cancellation" />
      <Checkbox checked={restock} onChange={(e) => setRestock(e.target.checked)} label="Return items to stock" />
      {paidOnline ? (
        <Checkbox
          checked={refund}
          disabled={!canRefund}
          onChange={(e) => setRefund(e.target.checked)}
          label="Refund the full amount through Razorpay"
          description={canRefund ? undefined : "Only an owner/admin can issue refunds."}
        />
      ) : null}
      <Button type="submit" size="sm" variant="danger" loading={pending}>
        Cancel order
      </Button>
    </form>
  );
}

export function QuickActions({
  orderId,
  status,
  paymentStatus,
  paymentMethod,
  needsAttention,
  canWrite,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  needsAttention: boolean;
  canWrite: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {canWrite && paymentStatus === "cod_pending" && status === "placed" ? (
        <ActionButton size="sm" action={() => markCodCollectedAction(orderId)} confirm="Confirm you have received the cash for this order?">
          Mark COD payment collected
        </ActionButton>
      ) : null}
      {paymentMethod === "razorpay" && ["pending_payment", "expired", "payment_failed", "cancelled"].includes(status) ? (
        <ActionButton size="sm" variant="secondary" action={() => reconcilePaymentAction(orderId)}>
          Check payment with Razorpay
        </ActionButton>
      ) : null}
      {canWrite && needsAttention ? (
        <ActionButton size="sm" variant="secondary" action={() => clearAttentionAction(orderId)}>
          Mark issue resolved
        </ActionButton>
      ) : null}
      {canWrite && status === "placed" ? (
        <ActionButton size="sm" variant="ghost" action={() => resendEmailAction(orderId, paymentMethod === "cod" ? "order_placed" : "payment_confirmed")}>
          Resend confirmation email
        </ActionButton>
      ) : null}
    </div>
  );
}
