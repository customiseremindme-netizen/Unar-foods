import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddressManager, type Address } from "@/components/account/address-manager";

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase!
    .from("addresses")
    .select("id, label, full_name, phone, line1, line2, landmark, city, state, pincode, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  return (
    <div>
      <h1 className="mb-8 text-[2.2rem]">Saved addresses</h1>
      <AddressManager addresses={(data ?? []) as Address[]} />
    </div>
  );
}
