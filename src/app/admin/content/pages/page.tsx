import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { PagesTable, groupPages } from "@/components/admin/pages-table";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Pages & policies" };

export default async function PagesListPage() {
  await requireStaffPage("content.write");
  const supabase = (await createSupabaseServerClient())!;
  const { data } = await supabase
    .from("cms_pages")
    .select("group_id, kind, state, slug, title, requires_owner_review, updated_at, published_at, body_md, excerpt, seo_title, seo_description, cover_image_url, cover_image_alt")
    .in("kind", ["page", "policy"])
    .order("kind")
    .order("title");
  const groups = groupPages(data ?? []);
  return (
    <div>
      <PageHeader
        title="Pages & policies"
        description="Your About page, other information pages and legal policies. Policies marked “Owner review required” show a notice on the website until you approve the wording."
        actions={
          <ButtonLink href="/admin/content/pages/new?kind=page" size="sm">
            New page
          </ButtonLink>
        }
      />
      <PagesTable groups={groups} />
    </div>
  );
}
