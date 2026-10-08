import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAllSettings } from "@/lib/settings";
import { Notice, PageHeader } from "@/components/admin/ui";
import { ZoneManager, type Zone } from "@/components/admin/marketing-managers";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = { title: "Shipping" };

export default async function ShippingPage() {
  await requireStaffPage("shipping.write");
  const supabase = (await createSupabaseServerClient())!;
  const [{ data: zones }, settings] = await Promise.all([supabase.from("shipping_zones").select("*").order("sort_order"), getAllSettings()]);
  const active = (zones ?? []).filter((z) => z.is_active);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Shipping"
        description="Where you deliver and what it costs. The checkout calculates shipping on the server from these zones, so customers can never change the price."
      />
      {active.length === 0 ? (
        <Notice tone="danger">
          No active shipping zone — customers can’t check out yet. Edit “All India — Standard” below, enter your real delivery charge, tick <strong>Active</strong> and save.
        </Notice>
      ) : null}
      <section className="space-y-3">
        <h2 className="font-sans text-[1.05rem] font-semibold tracking-normal text-forest">Shipping zones</h2>
        <ZoneManager zones={(zones ?? []) as Zone[]} />
      </section>
      <SettingsForm
        settingKey="shipping"
        title="Shipping options"
        initial={settings.shipping}
        fields={[
          { name: "enabled", label: "Shipping is enabled", type: "boolean", help: "Turn off only if you temporarily stop sending orders (customers then can't check out)." },
          { name: "origin_pincode", label: "Pickup PIN code (where parcels ship from)", type: "text", max: 6 },
          { name: "packaging_weight_grams", label: "Packaging weight added to every parcel (grams)", type: "number", min: 0, max: 20000 },
          { name: "checkout_note", label: "Note shown at checkout (optional)", type: "textarea", max: 300 },
          { name: "blocked_pincodes", label: "PIN codes you can't deliver to (one per line)", type: "lines", rows: 4, placeholder: "e.g. 744101" },
        ]}
      />
    </div>
  );
}
