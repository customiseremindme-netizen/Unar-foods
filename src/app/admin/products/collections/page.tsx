import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { PageHeader } from "@/components/admin/ui";
import { CollectionsManager } from "@/components/admin/collections-manager";

export const metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const { access } = await requireStaffPage("products.read");
  const db = (await getUserDb())!;
  const [{ data: categories }, { data: links }] = await Promise.all([
    db.from("categories").select("id, name, slug, description, sort_order, is_active").order("sort_order"),
    db.from("product_categories").select("category_id"),
  ]);
  const counts = new Map<string, number>();
  for (const l of links ?? []) counts.set(l.category_id, (counts.get(l.category_id) ?? 0) + 1);

  return (
    <div>
      <PageHeader
        title="Collections"
        back={{ href: "/admin/products", label: "All products" }}
        description="Groups of products customers can filter by in the shop (for example “Banana Chewy”). Add products to a collection from the product editor."
      />
      <CollectionsManager
        canWrite={access.permissions.has("products.write")}
        categories={(categories ?? []).map((c) => ({ ...c, description: c.description ?? "", products: counts.get(c.id) ?? 0 }))}
      />
    </div>
  );
}
