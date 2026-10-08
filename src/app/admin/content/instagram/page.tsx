import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { InstagramManager } from "@/components/admin/content-managers";

export const metadata = { title: "Instagram" };

export default async function InstagramPage() {
  await requireStaffPage("content.write");
  const supabase = (await createSupabaseServerClient())!;
  const { data } = await supabase.from("instagram_posts").select("*").order("sort_order");
  return (
    <div>
      <PageHeader
        title="Instagram"
        description="Add your Instagram posts by hand: upload the same image and paste the post link. No Instagram password or app is needed. The homepage shows up to 8 published posts; the section hides itself when there are none."
      />
      <InstagramManager posts={data ?? []} />
    </div>
  );
}
