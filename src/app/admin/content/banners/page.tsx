import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { PageHeader } from "@/components/admin/ui";
import { BannerManager } from "@/components/admin/content-managers";

export const metadata = { title: "Banners" };

export default async function BannersPage() {
  await requireStaffPage("content.write");
  const db = (await getUserDb())!;
  const { data } = await db.from("banners").select("*").order("placement").order("sort_order");
  return (
    <div>
      <PageHeader
        title="Banners"
        description="Short messages such as “Free shipping above ₹499”. The announcement bar shows at the very top of every page; other banners appear on the homepage or shop. You can schedule start and end dates (India time)."
      />
      <BannerManager banners={data ?? []} />
    </div>
  );
}
