import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/session";
import { getUserDb } from "@/lib/db/client";
import { KIND_LABELS } from "@/lib/admin/content-paths";
import { PageHeader } from "@/components/admin/ui";
import { PageEditor, type EditorPage } from "@/components/admin/page-editor";

export const metadata = { title: "Edit page" };

export default async function EditCmsPage({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { access } = await requireStaffPage("content.write");
  const { groupId } = await params;
  const { kind: kindParam } = await searchParams;
  const db = (await getUserDb())!;

  let initial: EditorPage;
  let isLive = false;
  if (groupId === "new") {
    const kind = (["page", "policy", "post"] as const).find((k) => k === kindParam) ?? "page";
    initial = {
      kind,
      slug: "",
      title: "",
      excerpt: "",
      body_md: "",
      cover_image_url: "",
      cover_image_alt: "",
      author_name: "",
      seo_title: "",
      seo_description: "",
      requires_owner_review: kind === "policy",
    };
  } else {
    if (!z.uuid().safeParse(groupId).success) notFound();
    const { data: rows } = await db.from("cms_pages").select("*").eq("group_id", groupId);
    const draft = rows?.find((r) => r.state === "draft") ?? rows?.find((r) => r.state === "published");
    if (!draft) notFound();
    isLive = !!rows?.some((r) => r.state === "published");
    initial = {
      group_id: groupId,
      kind: draft.kind as EditorPage["kind"],
      slug: draft.slug,
      title: draft.title,
      excerpt: draft.excerpt ?? "",
      body_md: draft.body_md,
      cover_image_url: draft.cover_image_url ?? "",
      cover_image_alt: draft.cover_image_alt ?? "",
      author_name: draft.author_name ?? "",
      seo_title: draft.seo_title ?? "",
      seo_description: draft.seo_description ?? "",
      requires_owner_review: draft.requires_owner_review,
    };
  }

  const back = initial.kind === "post" ? { href: "/admin/content/posts", label: "Journal" } : { href: "/admin/content/pages", label: "Pages & policies" };
  return (
    <div>
      <PageHeader title={initial.title || `New ${KIND_LABELS[initial.kind].toLowerCase()}`} back={back} />
      <PageEditor initial={initial} isLive={isLive} isOwner={access.role === "owner"} />
    </div>
  );
}
