"use client";

import { useActionState, useState } from "react";
import { deleteAddressAction, saveAddressAction, setDefaultAddressAction } from "@/app/actions/account";
import type { FormState } from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select } from "@/components/ui/field";
import { Badge, EmptyState } from "@/components/ui/misc";
import { INDIAN_STATES } from "@/lib/validation/common";

export type Address = {
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

const initial: FormState = { ok: false, message: null };

function AddressForm({ address, onDone }: { address: Address | null; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await saveAddressAction(prev, fd);
    if (result.ok) onDone();
    return result;
  }, initial);
  const e = state.errors ?? {};
  return (
    <form action={action} className="grid gap-4 rounded-[1.75rem] border border-line bg-paper p-6 sm:grid-cols-2" noValidate>
      <input type="hidden" name="id" value={address?.id ?? ""} />
      {state.message && !state.ok ? (
        <div className="sm:col-span-2">
          <FormMessage tone="error">{state.message}</FormMessage>
        </div>
      ) : null}
      <Field label="Label (e.g. Home, Office)" htmlFor="label" error={e.label}>
        <Input id="label" name="label" defaultValue={address?.label ?? ""} maxLength={40} />
      </Field>
      <Field label="Full name" htmlFor="full_name" required error={e.full_name}>
        <Input id="full_name" name="full_name" defaultValue={address?.full_name ?? ""} autoComplete="name" aria-invalid={!!e.full_name} />
      </Field>
      <Field label="Mobile number" htmlFor="phone" required error={e.phone}>
        <Input id="phone" name="phone" defaultValue={address?.phone ?? ""} inputMode="tel" aria-invalid={!!e.phone} />
      </Field>
      <Field label="PIN code" htmlFor="pincode" required error={e.pincode}>
        <Input id="pincode" name="pincode" defaultValue={address?.pincode ?? ""} inputMode="numeric" maxLength={6} aria-invalid={!!e.pincode} />
      </Field>
      <Field label="House / flat, building, street" htmlFor="line1" required error={e.line1} className="sm:col-span-2">
        <Input id="line1" name="line1" defaultValue={address?.line1 ?? ""} aria-invalid={!!e.line1} />
      </Field>
      <Field label="Area, locality (optional)" htmlFor="line2" error={e.line2}>
        <Input id="line2" name="line2" defaultValue={address?.line2 ?? ""} />
      </Field>
      <Field label="Landmark (optional)" htmlFor="landmark" error={e.landmark}>
        <Input id="landmark" name="landmark" defaultValue={address?.landmark ?? ""} />
      </Field>
      <Field label="City / town" htmlFor="city" required error={e.city}>
        <Input id="city" name="city" defaultValue={address?.city ?? ""} aria-invalid={!!e.city} />
      </Field>
      <Field label="State" htmlFor="state" required error={e.state}>
        <Select id="state" name="state" defaultValue={address?.state ?? ""} aria-invalid={!!e.state}>
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <Checkbox className="sm:col-span-2" name="is_default" defaultChecked={address?.is_default ?? false} label="Use as my default address" />
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" loading={pending}>
          Save address
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const [editing, setEditing] = useState<Address | "new" | null>(null);

  return (
    <div className="space-y-6">
      {editing ? (
        <AddressForm address={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <Button onClick={() => setEditing("new")}>Add a new address</Button>
      )}
      {addresses.length === 0 && !editing ? (
        <EmptyState title="No saved addresses" description="Save an address here or during checkout." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-[1.5rem] border border-line bg-paper p-5 text-[0.9rem]">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-forest">{a.label || a.full_name}</p>
                {a.is_default ? <Badge tone="sage">Default</Badge> : null}
              </div>
              <p className="mt-2 leading-relaxed text-muted">
                {a.full_name}
                <br />
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}
                <br />
                {a.landmark ? (
                  <>
                    Landmark: {a.landmark}
                    <br />
                  </>
                ) : null}
                {a.city}, {a.state} {a.pincode}
                <br />
                Phone: {a.phone}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-[0.85rem]">
                <button type="button" className="font-semibold text-forest underline" onClick={() => setEditing(a)}>
                  Edit
                </button>
                {!a.is_default ? (
                  <form action={setDefaultAddressAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-forest underline">Make default</button>
                  </form>
                ) : null}
                <form
                  action={deleteAddressAction}
                  onSubmit={(e) => {
                    if (!window.confirm("Delete this address?")) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-danger underline">Delete</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
