import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { PageHeader } from "@/components/admin/ui";
import { NewProductForm } from "@/components/admin/new-product-form";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const { access } = await requireStaffPage("products.write");
  const db = (await getUserDb())!;
  const { data: categories } = await db.from("categories").select("id, name").order("sort_order");
  return (
    <div>
      <PageHeader title="Add product" back={{ href: "/admin/products", label: "All products" }} />
      <NewProductForm categories={categories ?? []} canSetStock={access.permissions.has("inventory.write")} />
    </div>
  );
}
