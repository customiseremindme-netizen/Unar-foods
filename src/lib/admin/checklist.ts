import "server-only";
import { getEmailEnv, getRazorpayEnv, getCronSecret } from "@/lib/env";
import { getAllSettings } from "@/lib/settings";
import { requireServiceDb } from "@/lib/db/client";

export type ChecklistItem = { label: string; done: boolean; detail: string; href: string; optional?: boolean };

/** Launch readiness checks shown on the dashboard overview (all computed from real data/config). */
export async function getLaunchChecklist(): Promise<ChecklistItem[]> {
  const admin = requireServiceDb();
  const settings = await getAllSettings();
  const [products, variants, zones, policies] = await Promise.all([
    admin.from("products").select("id, status, claims, shelf_life, shelf_life_approved, gst_rate"),
    admin.from("product_variants").select("id, stock, is_demo_stock, product_id, products(status)"),
    admin.from("shipping_zones").select("id, cod_available").eq("is_active", true),
    admin.from("cms_pages").select("id").eq("kind", "policy").eq("state", "published").eq("requires_owner_review", true),
  ]);
  const published = (products.data ?? []).filter((p) => p.status === "published");
  const publishedVariants = (variants.data ?? []).filter(
    (v) => (v as unknown as { products: { status: string } | null }).products?.status === "published",
  );
  const unapprovedClaims = (products.data ?? []).some(
    (p) => Array.isArray(p.claims) && (p.claims as { approved?: boolean }[]).some((c) => !c.approved),
  );
  const razorpay = getRazorpayEnv();
  const codReady = settings.shipping.enabled && settings.checkout.cod_enabled && (zones.data ?? []).some((z) => z.cod_available);
  const onlineReady = settings.checkout.online_payments_enabled && razorpay?.mode === "live" && !!razorpay.webhookSecret;


  const items: ChecklistItem[] = [
    {
      label: "Confirm business contact details",
      done: settings.store.details_confirmed,
      detail: "Check email, phone, address and FSSAI number, then tick “Details confirmed”.",
      href: "/admin/settings#set-store",
    },
    {
      label: "Review product claims and labels",
      done: !unapprovedClaims,
      detail: "Approve only the claims you can stand behind. Unapproved claims stay hidden on the website.",
      href: "/admin/products",
    },
    {
      label: "Publish your products",
      done: published.length > 0,
      detail: published.length ? `${published.length} product(s) published.` : "Products are drafts until you publish them.",
      href: "/admin/products",
    },
    {
      label: "Enter real stock",
      done: publishedVariants.length > 0 && publishedVariants.every((v) => v.stock > 0 && !v.is_demo_stock),
      detail: "Customers can't buy items with zero stock. Use Inventory to add stock with a reason.",
      href: "/admin/inventory",
    },
    {
      label: "Set up shipping rates",
      done: (zones.data ?? []).length > 0,
      detail: (zones.data ?? []).length ? `${zones.data!.length} active shipping zone(s).` : "Checkout is blocked until at least one shipping zone is active.",
      href: "/admin/shipping",
    },
    {
      label: "Enable a checkout payment method",
      done: codReady || onlineReady,
      detail: codReady ? "COD enabled for at least one active delivery zone. Each address and order limit is checked at checkout."
        : onlineReady ? "Live online payments configured."
        : "For COD: enable Cash on Delivery in Settings → Checkout and in each eligible active shipping zone. Online payments can be connected later.",
      href: "/admin/settings#set-checkout",
    },
    {
      label: "Connect Razorpay payments",
      optional: codReady,
      done: !!razorpay,
      detail: razorpay ? `Connected in ${razorpay.mode.toUpperCase()} mode.` : "Add your Razorpay keys in your hosting settings (see the setup guide).",
      href: "/admin/integrations",
    },
    {
      label: "Add the Razorpay webhook",
      optional: codReady,
      done: !!razorpay?.webhookSecret,
      detail: "Lets payments be confirmed even if a customer closes the browser.",
      href: "/admin/integrations",
    },
    {
      label: "Switch Razorpay to live mode",
      optional: codReady,
      done: razorpay?.mode === "live",
      detail: "Test thoroughly first, then replace the test keys with live keys.",
      href: "/admin/integrations",
    },
    {
      label: "Connect account and order emails",
      done: !!getEmailEnv(),
      detail: "Account creation and password reset need Hostinger email (SMTP) or Resend. Open Integrations for the setup instructions.",
      href: "/admin/integrations",
    },
    {
      label: "Review your policies",
      done: (policies.data ?? []).length === 0,
      detail: (policies.data ?? []).length
        ? `${policies.data!.length} policy page(s) still marked OWNER REVIEW REQUIRED.`
        : "All policies reviewed.",
      href: "/admin/content/pages",
    },
    {
      label: "Configure payment maintenance access",
      optional: codReady,
      done: !!getCronSecret(),
      detail: "This checks CRON_SECRET only. Also schedule and verify the daily job in Hostinger; the website cannot confirm that hosting task is running.",
      href: "/admin/integrations",
    },
  ];
  if (settings.tax.gst_registered) {
    items.push({
      label: "Complete GST details",
      done: !!settings.tax.gstin && published.every((p) => p.gst_rate !== null),
      detail: "Enter your GSTIN and a GST rate + HSN code for every product (ask your accountant).",
      href: "/admin/settings#set-tax",
    });
  }
  return items;
}
