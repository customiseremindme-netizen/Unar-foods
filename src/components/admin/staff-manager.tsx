"use client";

import { useState } from "react";
import { addStaffAction, changeStaffRoleAction, removeStaffAction } from "@/app/admin/_actions/settings";
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { ActionButton, AdminForm, useAdminAction, useFieldError } from "./forms";
import { smallInput } from "./ui";

export function StaffRow({ userId, name, email, role, since, isSelf }: { userId: string; name: string; email: string; role: string; since: string; isSelf: boolean }) {
  const [value, setValue] = useState(role);
  const { run, pending } = useAdminAction();
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {name} {isSelf ? <Badge tone="sage">You</Badge> : null}
        </p>
        <p className="text-[0.78rem] text-muted">
          {email} · since {since}
        </p>
      </div>
      {isSelf ? (
        <Badge tone="forest">{ROLE_LABELS[role as StaffRole] ?? role}</Badge>
      ) : (
        <>
          <label className="sr-only" htmlFor={`role-${userId}`}>
            Role for {name}
          </label>
          <select
            id={`role-${userId}`}
            value={value}
            disabled={pending}
            onChange={async (e) => {
              const next = e.target.value;
              if (!window.confirm(`Change ${name}'s role to ${ROLE_LABELS[next as StaffRole]}?`)) return;
              const r = await run(() => changeStaffRoleAction(userId, next));
              if (r.ok) setValue(next);
            }}
            className={smallInput}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <ActionButton size="sm" variant="ghost" className="text-danger" action={() => removeStaffAction(userId)} confirm={`Remove ${name}'s dashboard access?`}>
            Remove
          </ActionButton>
        </>
      )}
    </li>
  );
}

function EmailField() {
  const error = useFieldError("email");
  return (
    <div className="min-w-64 flex-1">
      <Label htmlFor="staff-email">Their account email</Label>
      <Input id="staff-email" name="email" type="email" className="h-11" aria-invalid={!!error || undefined} />
      {error ? <p className="mt-1 text-[0.78rem] text-danger">{error}</p> : null}
    </div>
  );
}

export function AddStaffForm() {
  return (
    <AdminForm action={addStaffAction} resetOnSuccess className="flex flex-wrap items-end gap-3">
      <EmailField />
      <div>
        <Label htmlFor="staff-role">Role</Label>
        <Select id="staff-role" name="role" defaultValue="fulfillment" className="h-11 w-56 py-0">
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit">Give access</Button>
    </AdminForm>
  );
}
