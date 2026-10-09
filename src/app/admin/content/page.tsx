import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { PageHeader } from "@/components/admin/ui";
import { HomeEditor, type EditorSection } from "@/components/admin/home-editor";

export const metadata = { title: "Homepage" };

const comparable = (rows: { key: string; type: string; is_visible: boolean; content: unknown }[]) =>
  JSON.stringify(rows.map((r) => [r.key, r.type, r.is_visible, r.content]));

export default async function HomeContentPage() {
  await requireStaffPage("content.write");
  const db = (await getUserDb())!;
  const [{ data: sections }, { data: products }] = await Promise.all([
    db.from("cms_sections").select("key, type, state, sort_order, is_visible, content, updated_at, published_at").eq("page", "home").order("sort_order"),
    db.from("products").select("slug, title").neq("status", "archived").order("sort_order"),
  ]);
  const draft = (sections ?? []).filter((s) => s.state === "draft");
  const published = (sections ?? []).filter((s) => s.state === "published");
  const lastPublished = published.reduce<string | null>((max, s) => (s.published_at && (!max || s.published_at > max) ? s.published_at : max), null);

  return (
    <div>
      <PageHeader
        title="Homepage"
        description="Edit the sections of your homepage. Changes are saved as a draft first — use Preview to see them on the real site, then Publish."
      />
      <HomeEditor
        initial={draft.map((s) => ({ key: s.key, type: s.type, is_visible: s.is_visible, content: (s.content ?? {}) as Record<string, unknown> }) satisfies EditorSection)}
        hasUnpublished={comparable(draft) !== comparable(published)}
        lastPublished={lastPublished}
        products={products ?? []}
      />
    </div>
  );
}
