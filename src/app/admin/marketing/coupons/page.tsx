import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { PageHeader } from "@/components/admin/ui";
import { CouponManager, type Coupon } from "@/components/admin/marketing-managers";

export const metadata = { title: "Coupons" };

export default async function CouponsPage() {
  await requireStaffPage("marketing.write");
  const db = (await getUserDb())!;
  const [{ data: coupons }, { data: usages }] = await Promise.all([
    db.from("coupons").select("*").order("created_at", { ascending: false }),
    db.from("coupon_usages").select("coupon_id"),
  ]);
  const used = new Map<string, number>();
  for (const u of usages ?? []) used.set(u.coupon_id, (used.get(u.coupon_id) ?? 0) + 1);
  return (
    <div>
      <PageHeader
        title="Coupons"
        description="Discount codes customers enter at checkout. Discounts are checked and calculated on the server. Only advertise offers you really intend to honour."
      />
      <CouponManager coupons={(coupons ?? []).map((c) => ({ ...(c as Omit<Coupon, "used">), used: used.get(c.id) ?? 0 }))} />
    </div>
  );
}
