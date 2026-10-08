import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { Notice, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Abandoned carts" };

function oneHourAgo() {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

export default async function AbandonedCartsPage() {
  await requireStaffPage("marketing.write");
  const supabase = (await createSupabaseServerClient())!;
  const cutoff = oneHourAgo();
  const { data: carts } = await supabase
    .from("carts")
    .select("id, email, updated_at, recovery_consent, user_id, cart_items(quantity, product_variants(sku, title, price_paise, products(title)))")
    .eq("status", "active")
    .eq("recovery_consent", true)
    .not("email", "is", null)
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(100);
  const rows = (carts ?? []).filter((c) => (c.cart_items ?? []).length > 0);

  return (
    <div>
      <PageHeader
        title="Abandoned carts"
        description="Carts left for more than an hour by shoppers who entered their email at checkout AND agreed to a reminder. You can send them a friendly personal email."
      />
      <div className="mb-5">
        <Notice>Only people who gave permission are listed. Send at most one reminder, and never pressure customers.</Notice>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No abandoned carts" description="Nothing to follow up right now." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>Items</Th>
              <Th className="text-right">Value</Th>
              <Th>Last activity</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const value = (c.cart_items ?? []).reduce((s, i) => s + i.quantity * (i.product_variants?.price_paise ?? 0), 0);
              return (
                <tr key={c.id}>
                  <Td>
                    <a href={`mailto:${c.email}?subject=${encodeURIComponent("You left something in your UNAR cart")}`} className="text-forest underline">
                      {c.email}
                    </a>
                  </Td>
                  <Td className="text-[0.82rem]">
                    {(c.cart_items ?? []).map((i, idx) => (
                      <span key={idx} className="block">
                        {i.quantity} × {i.product_variants?.products?.title} ({i.product_variants?.title})
                      </span>
                    ))}
                  </Td>
                  <Td className="text-right tabular-nums">{formatINR(value)}</Td>
                  <Td className="text-muted">{formatDateTime(c.updated_at)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
