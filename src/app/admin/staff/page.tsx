import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, STAFF_ROLES } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { AddStaffForm, StaffRow } from "@/components/admin/staff-manager";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const { user } = await requireStaffPage("staff.manage");
  const db = (await getUserDb())!;
  const { data: staff } = await db.from("staff_members").select("user_id, role, created_at").order("created_at");
  const ids = (staff ?? []).map((s) => s.user_id);
  const { data: profiles } = ids.length ? await db.from("profiles").select("id, email, full_name").in("id", ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <PageHeader title="Staff" description="People who can use this dashboard. Give each person only the access they need. Each person signs in with their own account — never share passwords." />
      <Card title="Roles">
        <dl className="grid gap-3 sm:grid-cols-2">
          {STAFF_ROLES.map((r) => (
            <div key={r}>
              <dt className="text-[0.86rem] font-semibold">{ROLE_LABELS[r]}</dt>
              <dd className="text-[0.8rem] text-muted">{ROLE_DESCRIPTIONS[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Team">
        <ul className="divide-y divide-line/70">
          {(staff ?? []).map((s) => {
            const p = byId.get(s.user_id);
            return (
              <StaffRow
                key={s.user_id}
                userId={s.user_id}
                name={p?.full_name || p?.email || "Unknown"}
                email={p?.email ?? ""}
                role={s.role}
                since={formatDate(s.created_at)}
                isSelf={s.user_id === user.id}
              />
            );
          })}
        </ul>
      </Card>
      <Card title="Add a staff member" description="The person must first create a customer account on the website and confirm their email.">
        <AddStaffForm />
      </Card>
    </div>
  );
}
