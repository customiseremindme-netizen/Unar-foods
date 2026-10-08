import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/settings";
import { getRazorpayEnv } from "@/lib/env";
import { getCartView } from "@/lib/commerce/cart";
import { CheckoutForm, type SavedAddress } from "@/components/checkout/checkout-form";
import { EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [user, settings, cart] = await Promise.all([getSessionUser(), getPublicSettings(), getCartView()]);

  if (!user && !settings.checkout.guest_checkout_enabled) redirect("/login?next=/checkout");

  if (cart.lines.length === 0) {
    return (
      <div className="container-site py-20">
        <EmptyState
          title="Your cart is empty"
          description="Add something you love, then come back to check out."
          action={<ButtonLink href="/shop">Shop Banana Chewy</ButtonLink>}
        />
      </div>
    );
  }

  let profile: { full_name: string | null; phone: string | null } | null = null;
  let addresses: SavedAddress[] = [];
  if (user) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const [p, a] = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
        supabase
          .from("addresses")
          .select("id, label, full_name, phone, line1, line2, landmark, city, state, pincode, is_default")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      profile = p.data;
      addresses = a.data ?? [];
    }
  }

  const onlineAvailable = settings.checkout.online_payments_enabled && getRazorpayEnv() !== null;

  return (
    <div className="container-site py-10 lg:py-14">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[2.4rem] sm:text-[3rem]">Checkout</h1>
        <p className="inline-flex items-center gap-2 text-[0.85rem] text-muted">
          <Lock className="size-4 text-olive" aria-hidden="true" /> Secure checkout — prices and stock are confirmed on our server
        </p>
      </div>
      {settings.shipping.checkout_note ? (
        <p className="mb-8 rounded-2xl bg-sage-soft px-5 py-4 text-[0.9rem] text-forest">{settings.shipping.checkout_note}</p>
      ) : null}
      <CheckoutForm
        initialEmail={user?.email ?? ""}
        initialPhone={profile?.phone ?? ""}
        initialName={profile?.full_name ?? ""}
        savedAddresses={addresses}
        signedIn={!!user}
        onlineAvailable={onlineAvailable}
        codEnabled={settings.checkout.cod_enabled}
        newsletterConsentText={settings.newsletter.consent_text}
        themeColor={settings.theme.forest}
        pricesIncludeTax={settings.tax.prices_include_tax}
      />
    </div>
  );
}
