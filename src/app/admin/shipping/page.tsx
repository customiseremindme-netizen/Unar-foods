import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { getAllSettings } from "@/lib/settings";
import { Notice, PageHeader } from "@/components/admin/ui";
import { ZoneManager, type Zone } from "@/components/admin/marketing-managers";
import { SettingsForm } from "@/components/admin/settings-form";
import { ActionButton } from "@/components/admin/forms";
import { enableCashOnDeliveryAction } from "@/app/admin/_actions/settings";
import { availablePaymentMethods } from "@/lib/commerce/payment-methods";

export const metadata = { title: "Shipping" };

export default async function ShippingPage() {
  const { access } = await requireStaffPage("shipping.write");
  const db = (await getUserDb())!;
  const [{ data: zones }, settings] = await Promise.all([db.from("shipping_zones").select("*").order("sort_order"), getAllSettings()]);
  const active = (zones ?? []).filter((z) => z.is_active);
  const codZones = active.filter((z) => z.cod_available);
  const methods = await availablePaymentMethods(settings);
  const canEnableCod = access.permissions.has("settings.write");

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
      {codZones.length > 0 && !settings.checkout.cod_enabled ? (
        <Notice tone="warning">
          <span className="block">
            <strong>Cash on Delivery is switched off for the whole shop</strong>, so customers don&apos;t see it even though{" "}
            {codZones.map((z) => `“${z.name}”`).join(", ")} {codZones.length === 1 ? "allows" : "allow"} it.
          </span>
          {canEnableCod ? (
            <ActionButton action={enableCashOnDeliveryAction} size="sm" className="mt-3" successMessage="Cash on Delivery is now on.">
              Switch on Cash on Delivery
            </ActionButton>
          ) : (
            <span className="mt-1 block">Ask the owner to switch it on in Settings → Checkout &amp; payments.</span>
          )}
        </Notice>
      ) : null}
      {methods.length === 0 ? (
        <Notice tone="danger">
          No way to pay is switched on, so nobody can place an order. Switch on Cash on Delivery or UPI in Settings → Checkout &amp; payments, or add
          your Razorpay / PhonePe keys in Hostinger.
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
