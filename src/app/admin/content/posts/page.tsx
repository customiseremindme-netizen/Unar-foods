import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { PagesTable, groupPages } from "@/components/admin/pages-table";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Journal" };

export default async function PostsListPage() {
  await requireStaffPage("content.write");
  const supabase = (await createSupabaseServerClient())!;
  const { data } = await supabase
    .from("cms_pages")
    .select("group_id, kind, state, slug, title, requires_owner_review, updated_at, published_at, body_md, excerpt, seo_title, seo_description, cover_image_url, cover_image_alt")
    .eq("kind", "post")
    .order("updated_at", { ascending: false });
  return (
    <div>
      <PageHeader
        title="Journal"
        description="Articles for your Journal page (/blog) — recipes, stories and news. Only publish facts you can stand behind."
        actions={
          <ButtonLink href="/admin/content/pages/new?kind=post" size="sm">
            New post
          </ButtonLink>
        }
      />
      <PagesTable groups={groupPages(data ?? [])} emptyText="No journal posts yet." />
    </div>
  );
}
