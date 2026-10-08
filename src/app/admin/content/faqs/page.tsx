import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { FaqManager } from "@/components/admin/content-managers";

export const metadata = { title: "FAQs" };

export default async function FaqsPage() {
  await requireStaffPage("content.write");
  const supabase = (await createSupabaseServerClient())!;
  const { data } = await supabase.from("faqs").select("id, question, answer_md, category, sort_order, is_published, show_on_home").order("sort_order");
  return (
    <div>
      <PageHeader title="FAQs" description="Questions shown on the FAQ page (and on the homepage when “Show on homepage” is ticked). Answer only with facts you are sure about." />
      <FaqManager faqs={data ?? []} />
    </div>
  );
}
