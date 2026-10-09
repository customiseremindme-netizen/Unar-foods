import "server-only";
import { getEmailEnv, getRazorpayEnv, getCronSecret } from "@/lib/env";
import { getAllSettings } from "@/lib/settings";
import { requireServiceDb } from "@/lib/db/client";

export type ChecklistItem = { label: string; done: boolean; detail: string; href: string };

/** Launch readiness checks shown on the dashboard overview (all computed from real data/config). */
export async function getLaunchChecklist(): Promise<ChecklistItem[]> {
  const admin = requireServiceDb();
  const settings = await getAllSettings();
  const [products, variants, zones, policies] = await Promise.all([
    admin.from("products").select("id, status, claims, shelf_life, shelf_life_approved, gst_rate"),
    admin.from("product_variants").select("id, stock, is_demo_stock, product_id, products(status)"),
    admin.from("shipping_zones").select("id").eq("is_active", true),
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

  const items: ChecklistItem[] = [
    {
      label: "Confirm business contact details",
      done: settings.store.details_confirmed,
      detail: "Check email, phone, address and FSSAI number, then tick “Details confirmed”.",
      href: "/admin/settings?tab=store",
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
      label: "Connect Razorpay payments",
      done: !!razorpay,
      detail: razorpay ? `Connected in ${razorpay.mode.toUpperCase()} mode.` : "Add your Razorpay keys in your hosting settings (see the setup guide).",
      href: "/admin/integrations",
    },
    {
      label: "Add the Razorpay webhook",
      done: !!razorpay?.webhookSecret,
      detail: "Lets payments be confirmed even if a customer closes the browser.",
      href: "/admin/integrations",
    },
    {
      label: "Switch Razorpay to live mode",
      done: razorpay?.mode === "live",
      detail: "Test thoroughly first, then replace the test keys with live keys.",
      href: "/admin/integrations",
    },
    {
      label: "Connect order emails",
      done: !!getEmailEnv(),
      detail: "Add your Hostinger email (SMTP) or Resend details so customers receive order emails.",
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
      label: "Schedule the payment clean-up job",
      done: !!getCronSecret(),
      detail: "Set CRON_SECRET and add a daily Hostinger cron job — see the setup guide, Part 5.",
      href: "/admin/integrations",
    },
  ];
  if (settings.tax.gst_registered) {
    items.push({
      label: "Complete GST details",
      done: !!settings.tax.gstin && published.every((p) => p.gst_rate !== null),
      detail: "Enter your GSTIN and a GST rate + HSN code for every product (ask your accountant).",
      href: "/admin/settings?tab=tax",
    });
  }
  return items;
}
