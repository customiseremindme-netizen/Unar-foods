import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { getSetting } from "@/lib/settings";
import { paiseToRupeesInput } from "@/lib/money";
import { getRequestSiteUrl } from "@/lib/site-url";
import { PageHeader } from "@/components/admin/ui";
import { ProductEditor, type EditorProduct } from "@/components/admin/product-editor";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Edit product" };

type Label = { label: string; approved: boolean };
const labels = (raw: unknown): Label[] =>
  Array.isArray(raw) ? raw.filter((x) => x && typeof x === "object").map((x) => ({ label: String(x.label ?? ""), approved: x.approved === true })) : [];

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { access } = await requireStaffPage("products.read");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = (await getUserDb())!;
  const [{ data: p }, { data: categories }, tax] = await Promise.all([
    db
      .from("products")
      .select("*, product_variants(*), product_images(*), product_categories(category_id)")
      .eq("id", id)
      .maybeSingle(),
    db.from("categories").select("id, name, is_active").order("sort_order"),
    getSetting("tax"),
  ]);
  if (!p) notFound();

  const initial: EditorProduct = {
    id: p.id,
    title: p.title,
    short_title: p.short_title ?? "",
    subtitle: p.subtitle ?? "",
    slug: p.slug,
    status: p.status as EditorProduct["status"],
    short_description: p.short_description ?? "",
    description_md: p.description_md ?? "",
    ingredients: p.ingredients ?? "",
    allergens: p.allergens ?? "",
    dietary_mark: p.dietary_mark === "vegetarian" ? "vegetarian" : "",
    nutrition: Array.isArray(p.nutrition)
      ? (p.nutrition as { nutrient?: unknown; per_100g?: unknown }[]).map((r) => ({ nutrient: String(r?.nutrient ?? ""), per_100g: String(r?.per_100g ?? "") }))
      : [],
    nutrition_note: p.nutrition_note ?? "",
    claims: labels(p.claims),
    benefits: labels(p.benefits),
    storage_instructions: p.storage_instructions ?? "",
    shelf_life: p.shelf_life ?? "",
    shelf_life_approved: p.shelf_life_approved,
    shipping_returns_md: p.shipping_returns_md ?? "",
    manufacturer_info: p.manufacturer_info ?? "",
    fssai_license: p.fssai_license ?? "",
    hsn_code: p.hsn_code ?? "",
    gst_rate: p.gst_rate === null ? "" : String(Number(p.gst_rate)),
    is_featured: p.is_featured,
    sort_order: p.sort_order,
    seo_title: p.seo_title ?? "",
    seo_description: p.seo_description ?? "",
    og_image_url: p.og_image_url ?? "",
    category_ids: (p.product_categories ?? []).map((c) => c.category_id),
    variants: [...(p.product_variants ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({
        id: v.id,
        title: v.title,
        sku: v.sku,
        barcode: v.barcode ?? "",
        weight_grams: v.weight_grams,
        mrp: paiseToRupeesInput(v.mrp_paise),
        price: paiseToRupeesInput(v.price_paise),
        low_stock_threshold: v.low_stock_threshold,
        is_active: v.is_active,
        stock: v.stock,
        is_demo_stock: v.is_demo_stock,
      })),
    images: [...(p.product_images ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ id: i.id, url: i.url, alt: i.alt, kind: i.kind as EditorProduct["images"][number]["kind"], width: i.width, height: i.height })),
  };

  return (
    <div>
      <PageHeader
        title={p.title}
        back={{ href: "/admin/products", label: "All products" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={p.status === "published" ? "success" : p.status === "archived" ? "muted" : "neutral"}>{p.status === "published" ? "Live" : p.status}</Badge>
            <span>Changes are saved only when you press Save. Stock levels are changed in Inventory.</span>
          </span>
        }
      />
      <ProductEditor
        initial={initial}
        categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name, is_active: c.is_active }))}
        canWrite={access.permissions.has("products.write")}
        gstRegistered={tax.gst_registered}
        siteHost={new URL(await getRequestSiteUrl()).host}
      />
    </div>
  );
}
