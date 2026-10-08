"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { deleteCouponAction, deleteZoneAction, saveCouponAction, saveZoneAction } from "@/app/admin/_actions/marketing";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { formatINR, paiseToRupeesInput } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { INDIAN_STATES } from "@/lib/validation/common";
import { ActionButton, AdminForm, useFieldError } from "./forms";
import { Card } from "./ui";

function Err({ name }: { name: string }) {
  const message = useFieldError(name);
  return message ? <p className="mt-1 text-[0.78rem] font-medium text-danger">{message}</p> : null;
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed" | "free_shipping";
  discount_value: number;
  min_subtotal_paise: number;
  max_discount_paise: number | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  used: number;
};

export function describeCoupon(c: Pick<Coupon, "discount_type" | "discount_value" | "min_subtotal_paise" | "max_discount_paise">) {
  const what =
    c.discount_type === "percent"
      ? `${c.discount_value}% off${c.max_discount_paise ? ` (up to ${formatINR(c.max_discount_paise)})` : ""}`
      : c.discount_type === "fixed"
        ? `${formatINR(c.discount_value)} off`
        : "Free shipping";
  return c.min_subtotal_paise ? `${what} on orders of ${formatINR(c.min_subtotal_paise)}+` : what;
}

function CouponFields({ c }: { c?: Coupon }) {
  const [type, setType] = useState<Coupon["discount_type"]>(c?.discount_type ?? "percent");
  const p = c?.id ?? "new";
  return (
    <div className="grid gap-4">
      <input type="hidden" name="id" value={c?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${p}-code`}>Code customers type</Label>
          <Input id={`${p}-code`} name="code" defaultValue={c?.code} maxLength={32} className="h-11 font-mono uppercase" placeholder="WELCOME10" />
          <Err name="code" />
        </div>
        <div>
          <Label htmlFor={`${p}-desc`}>Internal note (optional)</Label>
          <Input id={`${p}-desc`} name="description" defaultValue={c?.description ?? ""} maxLength={200} className="h-11" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor={`${p}-type`}>Discount</Label>
          <Select id={`${p}-type`} name="discount_type" value={type} onChange={(e) => setType(e.target.value as Coupon["discount_type"])}>
            <option value="percent">Percentage off</option>
            <option value="fixed">Fixed amount off (₹)</option>
            <option value="free_shipping">Free shipping</option>
          </Select>
        </div>
        {type !== "free_shipping" ? (
          <div>
            <Label htmlFor={`${p}-val`}>{type === "percent" ? "Percent (1–100)" : "Amount (₹)"}</Label>
            <Input
              id={`${p}-val`}
              name="value"
              inputMode="decimal"
              defaultValue={c ? (c.discount_type === "fixed" ? paiseToRupeesInput(c.discount_value) : c.discount_type === "percent" ? String(c.discount_value) : "") : ""}
              className="h-11"
            />
          </div>
        ) : null}
        {type === "percent" ? (
          <div>
            <Label htmlFor={`${p}-max`}>Maximum discount (₹, optional)</Label>
            <Input id={`${p}-max`} name="max_discount" inputMode="decimal" defaultValue={paiseToRupeesInput(c?.max_discount_paise)} className="h-11" />
            <Err name="max_discount" />
          </div>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor={`${p}-min`}>Minimum order (₹, optional)</Label>
          <Input id={`${p}-min`} name="min_subtotal" inputMode="decimal" defaultValue={c?.min_subtotal_paise ? paiseToRupeesInput(c.min_subtotal_paise) : ""} className="h-11" />
          <Err name="min_subtotal" />
        </div>
        <div>
          <Label htmlFor={`${p}-lim`}>Total uses allowed (optional)</Label>
          <Input id={`${p}-lim`} name="usage_limit" type="number" min={1} defaultValue={c?.usage_limit ?? ""} className="h-11" />
          <Err name="usage_limit" />
        </div>
        <div>
          <Label htmlFor={`${p}-pcl`}>Uses per customer (optional)</Label>
          <Input id={`${p}-pcl`} name="per_customer_limit" type="number" min={1} defaultValue={c?.per_customer_limit ?? ""} className="h-11" />
          <Err name="per_customer_limit" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${p}-st`}>Starts (optional, India time)</Label>
          <Input id={`${p}-st`} name="starts_at" type="datetime-local" defaultValue={toLocalInput(c?.starts_at ?? null)} className="h-11" />
        </div>
        <div>
          <Label htmlFor={`${p}-en`}>Ends (optional)</Label>
          <Input id={`${p}-en`} name="ends_at" type="datetime-local" defaultValue={toLocalInput(c?.ends_at ?? null)} className="h-11" />
          <Err name="ends_at" />
        </div>
      </div>
      <Checkbox name="is_active" defaultChecked={c?.is_active ?? true} label="Active" description="Customers can only use active coupons within their dates." />
    </div>
  );
}

export function CouponManager({ coupons }: { coupons: Coupon[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const now = new Date().toISOString();
  return (
    <div className="space-y-3">
      {coupons.map((c) => {
        const expired = !!c.ends_at && c.ends_at <= now;
        const exhausted = c.usage_limit !== null && c.used >= c.usage_limit;
        return editing === c.id ? (
          <Card key={c.id} title={`Edit ${c.code}`}>
            <AdminForm action={saveCouponAction} onSuccess={() => setEditing(null)}>
              <CouponFields c={c} />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit" size="sm">
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <ActionButton size="sm" variant="ghost" className="text-danger" action={() => deleteCouponAction(c.id)} confirm={`Delete coupon ${c.code}?`}>
                  Delete
                </ActionButton>
              </div>
            </AdminForm>
          </Card>
        ) : (
          <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-line bg-paper px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[1rem] font-semibold text-forest">{c.code}</p>
              <p className="text-[0.84rem]">{describeCoupon(c)}</p>
              <p className="mt-1 text-[0.76rem] text-muted">
                Used {c.used}
                {c.usage_limit ? ` of ${c.usage_limit}` : ""} times
                {c.per_customer_limit ? ` · ${c.per_customer_limit} per customer` : ""}
                {c.starts_at || c.ends_at ? ` · ${c.starts_at ? formatDate(c.starts_at) : "now"} → ${c.ends_at ? formatDate(c.ends_at) : "no end"}` : ""}
              </p>
            </div>
            {!c.is_active ? <Badge tone="muted">Off</Badge> : expired ? <Badge tone="neutral">Expired</Badge> : exhausted ? <Badge tone="neutral">Used up</Badge> : <Badge tone="success">Active</Badge>}
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(c.id)}>
              Edit
            </Button>
          </div>
        );
      })}
      <NewCard label="Create a coupon">
        {(close) => (
          <AdminForm action={saveCouponAction} onSuccess={close}>
            <CouponFields />
            <div className="mt-4 flex gap-2">
              <Button type="submit" size="sm">
                Create coupon
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={close}>
                Cancel
              </Button>
            </div>
          </AdminForm>
        )}
      </NewCard>
    </div>
  );
}

function NewCard({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <Card title={label}>{children(() => setOpen(false))}</Card>
  ) : (
    <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
      <Plus className="size-3.5" aria-hidden="true" /> {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Shipping zones
// ---------------------------------------------------------------------------
export type Zone = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  match_type: "all" | "states" | "pincode_prefixes";
  states: string[];
  pincode_prefixes: string[];
  rate_type: "flat" | "weight";
  flat_rate_paise: number;
  base_weight_grams: number;
  base_rate_paise: number;
  additional_weight_step_grams: number;
  additional_rate_paise: number;
  free_shipping_threshold_paise: number | null;
  cod_available: boolean;
  delivery_estimate: string | null;
  notes: string | null;
};

function describeZone(z: Zone) {
  const where = z.match_type === "all" ? "All of India" : z.match_type === "states" ? z.states.join(", ") : `PIN codes starting ${z.pincode_prefixes.join(", ")}`;
  const rate =
    z.rate_type === "flat"
      ? z.flat_rate_paise === 0
        ? "Free"
        : `${formatINR(z.flat_rate_paise)} flat`
      : `${formatINR(z.base_rate_paise)} up to ${z.base_weight_grams} g, then ${formatINR(z.additional_rate_paise)} per ${z.additional_weight_step_grams} g`;
  const free = z.free_shipping_threshold_paise !== null ? ` · free above ${formatINR(z.free_shipping_threshold_paise)}` : "";
  return { where, rate: rate + free };
}

function ZoneFields({ z }: { z?: Zone }) {
  const p = z?.id ?? "new";
  const [match, setMatch] = useState<Zone["match_type"]>(z?.match_type ?? "all");
  const [rateType, setRateType] = useState<Zone["rate_type"]>(z?.rate_type ?? "flat");
  return (
    <div className="grid gap-4">
      <input type="hidden" name="id" value={z?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <div>
          <Label htmlFor={`${p}-name`}>Zone name</Label>
          <Input id={`${p}-name`} name="name" defaultValue={z?.name} maxLength={80} className="h-11" placeholder="e.g. Tamil Nadu" />
          <Err name="name" />
        </div>
        <div>
          <Label htmlFor={`${p}-so`}>Order</Label>
          <Input id={`${p}-so`} name="sort_order" type="number" min={0} defaultValue={z?.sort_order ?? 0} className="h-11" />
        </div>
      </div>
      <div>
        <Label htmlFor={`${p}-match`}>Applies to</Label>
        <Select id={`${p}-match`} name="match_type" value={match} onChange={(e) => setMatch(e.target.value as Zone["match_type"])}>
          <option value="all">All of India (fallback)</option>
          <option value="states">Selected states</option>
          <option value="pincode_prefixes">PIN codes starting with…</option>
        </Select>
        <p className="mt-1 text-[0.75rem] text-muted">The most specific matching zone wins: PIN codes, then states, then “All of India”.</p>
      </div>
      {match === "states" ? (
        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-[0.82rem] font-semibold">States</legend>
          <div className="grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {INDIAN_STATES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-[0.84rem]">
                <input type="checkbox" name="states" value={s} defaultChecked={z?.states.includes(s)} className="accent-[var(--color-forest)]" />
                {s}
              </label>
            ))}
          </div>
          <Err name="states" />
        </fieldset>
      ) : null}
      {match === "pincode_prefixes" ? (
        <div>
          <Label htmlFor={`${p}-pins`}>PIN code prefixes (comma separated)</Label>
          <Textarea id={`${p}-pins`} name="pincode_prefixes" rows={2} defaultValue={z?.pincode_prefixes.join(", ")} placeholder="641, 642, 6380" />
          <Err name="pincode_prefixes" />
        </div>
      ) : null}
      <div>
        <Label htmlFor={`${p}-rt`}>How to charge</Label>
        <Select id={`${p}-rt`} name="rate_type" value={rateType} onChange={(e) => setRateType(e.target.value as Zone["rate_type"])}>
          <option value="flat">Same price for every order</option>
          <option value="weight">By parcel weight</option>
        </Select>
      </div>
      {rateType === "flat" ? (
        <div className="max-w-xs">
          <Label htmlFor={`${p}-flat`}>Shipping charge (₹)</Label>
          <Input id={`${p}-flat`} name="flat_rate" inputMode="decimal" defaultValue={paiseToRupeesInput(z?.flat_rate_paise ?? 0)} className="h-11" />
          <Err name="flat_rate" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor={`${p}-bw`}>First (grams)</Label>
            <Input id={`${p}-bw`} name="base_weight_grams" type="number" min={1} defaultValue={z?.base_weight_grams ?? 500} className="h-11" />
          </div>
          <div>
            <Label htmlFor={`${p}-br`}>costs (₹)</Label>
            <Input id={`${p}-br`} name="base_rate" inputMode="decimal" defaultValue={paiseToRupeesInput(z?.base_rate_paise ?? 0)} className="h-11" />
            <Err name="base_rate" />
          </div>
          <div>
            <Label htmlFor={`${p}-aw`}>Each extra (grams)</Label>
            <Input id={`${p}-aw`} name="additional_weight_step_grams" type="number" min={1} defaultValue={z?.additional_weight_step_grams ?? 500} className="h-11" />
          </div>
          <div>
            <Label htmlFor={`${p}-ar`}>costs (₹)</Label>
            <Input id={`${p}-ar`} name="additional_rate" inputMode="decimal" defaultValue={paiseToRupeesInput(z?.additional_rate_paise ?? 0)} className="h-11" />
            <Err name="additional_rate" />
          </div>
        </div>
      )}
      {rateType === "flat" ? (
        <>
          <input type="hidden" name="base_weight_grams" value={z?.base_weight_grams ?? 500} />
          <input type="hidden" name="additional_weight_step_grams" value={z?.additional_weight_step_grams ?? 500} />
        </>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${p}-free`}>Free shipping above (₹, optional)</Label>
          <Input id={`${p}-free`} name="free_shipping_threshold" inputMode="decimal" defaultValue={paiseToRupeesInput(z?.free_shipping_threshold_paise)} className="h-11" />
          <Err name="free_shipping_threshold" />
        </div>
        <div>
          <Label htmlFor={`${p}-eta`}>Delivery estimate shown to customers (optional)</Label>
          <Input id={`${p}-eta`} name="delivery_estimate" defaultValue={z?.delivery_estimate ?? ""} maxLength={80} className="h-11" placeholder="e.g. 3–6 working days" />
          <p className="mt-1 text-[0.75rem] text-muted">Only enter a time you can reliably meet.</p>
        </div>
      </div>
      <div>
        <Label htmlFor={`${p}-notes`}>Internal notes (optional)</Label>
        <Input id={`${p}-notes`} name="notes" defaultValue={z?.notes ?? ""} maxLength={300} className="h-11" />
      </div>
      <div className="flex flex-wrap gap-6">
        <Checkbox name="cod_available" defaultChecked={z?.cod_available ?? false} label="Cash on Delivery available here" description="COD must also be switched on in Settings → Checkout." />
        <Checkbox name="is_active" defaultChecked={z?.is_active ?? true} label="Active" />
      </div>
    </div>
  );
}

export function ZoneManager({ zones }: { zones: Zone[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {zones.map((zone) => {
        const d = describeZone(zone);
        return editing === zone.id ? (
          <Card key={zone.id} title={`Edit ${zone.name}`}>
            <AdminForm action={saveZoneAction} onSuccess={() => setEditing(null)}>
              <ZoneFields z={zone} />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit" size="sm">
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <ActionButton size="sm" variant="ghost" className="text-danger" action={() => deleteZoneAction(zone.id)} confirm={`Delete the zone “${zone.name}”?`}>
                  Delete
                </ActionButton>
              </div>
            </AdminForm>
          </Card>
        ) : (
          <div key={zone.id} className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-line bg-paper px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-forest">{zone.name}</p>
              <p className="text-[0.84rem]">{d.rate}</p>
              <p className="mt-1 text-[0.76rem] text-muted">
                {d.where}
                {zone.cod_available ? " · COD available" : ""}
                {zone.delivery_estimate ? ` · ${zone.delivery_estimate}` : ""}
              </p>
            </div>
            {zone.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="muted">Inactive</Badge>}
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(zone.id)}>
              Edit
            </Button>
          </div>
        );
      })}
      <NewCard label="Add a shipping zone">
        {(close) => (
          <AdminForm action={saveZoneAction} onSuccess={close}>
            <ZoneFields />
            <div className="mt-4 flex gap-2">
              <Button type="submit" size="sm">
                Add zone
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={close}>
                Cancel
              </Button>
            </div>
          </AdminForm>
        )}
      </NewCard>
    </div>
  );
}
