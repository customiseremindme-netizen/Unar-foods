import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/orders/view";
import { emailSchema } from "@/lib/validation/common";
import { Card, PageHeader, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ email: string }> }) {
  const { access } = await requireStaffPage("customers.read");
  const parsed = emailSchema.safeParse(decodeURIComponent((await params).email));
  if (!parsed.success) notFound();
  const email = parsed.data;
  // exact, case-insensitive match (escape LIKE wildcards such as "_" in emails)
  const like = email.replace(/[\\%_]/g, (m) => `\\${m}`);
  const supabase = (await createSupabaseServerClient())!;

  const [{ data: profile }, { data: orders }, { data: subscriber }, { data: messages }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, marketing_consent, created_at").ilike("email", like).maybeSingle(),
    access.permissions.has("orders.read")
      ? supabase
          .from("orders")
          .select("id, order_number, created_at, total_paise, refunded_paise, status, payment_status, fulfillment_status, payment_method, customer_name, phone, shipping_address")
          .ilike("email", like)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: null }),
    access.permissions.has("marketing.write") ? supabase.from("subscribers").select("status, consent_at, unsubscribed_at").eq("email", email).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("contact_messages").select("id, subject, created_at, status").ilike("email", like).order("created_at", { ascending: false }).limit(20),
  ]);
  const { data: addresses } = profile ? await supabase.from("addresses").select("*").eq("user_id", profile.id).order("is_default", { ascending: false }) : { data: null };

  if (!profile && (!orders || orders.length === 0) && !messages?.length) notFound();

  const paid = (orders ?? []).filter((o) => ["paid", "partially_refunded", "refunded", "cod_collected"].includes(o.payment_status));
  const spent = paid.reduce((sum, o) => sum + o.total_paise - o.refunded_paise, 0);
  const name = profile?.full_name || orders?.[0]?.customer_name || email;
  const phone = profile?.phone || orders?.[0]?.phone;

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        back={{ href: "/admin/customers", label: "All customers" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {profile ? <Badge tone="sage">Account since {formatDate(profile.created_at)}</Badge> : <Badge tone="muted">Guest (no account)</Badge>}
            <a href={`mailto:${email}`} className="text-forest underline">
              {email}
            </a>
            {phone ? (
              <a href={`tel:+91${phone}`} className="text-forest underline">
                +91 {phone}
              </a>
            ) : null}
          </span>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Orders" value={orders?.length ?? "—"} />
        <StatCard label="Paid orders" value={paid.length} />
        <StatCard label="Total spent" value={formatINR(spent)} hint="Paid orders, minus refunds" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Orders">
          {!orders ? (
            <p className="text-[0.88rem] text-muted">Your role can’t view orders.</p>
          ) : orders.length === 0 ? (
            <p className="text-[0.88rem] text-muted">No orders yet.</p>
          ) : (
            <Table className="border-0">
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Placed</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const st = orderStatusLabel(o);
                  return (
                    <tr key={o.id}>
                      <Td>
                        <Link href={`/admin/orders/${o.id}`} className="font-semibold text-forest hover:underline">
                          {o.order_number}
                        </Link>
                      </Td>
                      <Td>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </Td>
                      <Td className="text-right tabular-nums">{formatINR(o.total_paise)}</Td>
                      <Td className="text-muted">{formatDateTime(o.created_at)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="Marketing">
            <p className="text-[0.88rem]">
              Agreed to marketing emails: <strong>{profile?.marketing_consent ? "Yes" : "No"}</strong>
            </p>
            {subscriber ? (
              <p className="mt-2 text-[0.82rem] text-muted">
                Newsletter: {subscriber.status === "subscribed" ? `subscribed ${formatDate(subscriber.consent_at)}` : `unsubscribed ${formatDate(subscriber.unsubscribed_at)}`}
              </p>
            ) : null}
            <p className="mt-2 text-[0.75rem] text-muted">Only send marketing emails to people who agreed to receive them.</p>
          </Card>
          {addresses && addresses.length ? (
            <Card title="Saved addresses">
              <ul className="space-y-3 text-[0.85rem]">
                {addresses.map((a) => (
                  <li key={a.id} className="rounded-xl bg-cream/60 p-3">
                    <strong>{a.full_name}</strong>
                    {a.is_default ? <span className="ml-2 text-[0.72rem] text-muted">default</span> : null}
                    <br />
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}
                    <br />
                    {a.city}, {a.state} {a.pincode}
                    <br />
                    {a.phone}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {messages && messages.length ? (
            <Card title="Messages">
              <ul className="space-y-2 text-[0.85rem]">
                {messages.map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/messages?open=${m.id}`} className="text-forest underline">
                      {m.subject || "(no subject)"}
                    </Link>{" "}
                    <span className="text-muted">· {formatDate(m.created_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
