import type { Pool } from "mysql2/promise";
import { raise, type DbContext } from "../rest/context";
import { actorId, exec, insertRow, one, requirePerm, tx } from "./helpers";

/** Website content: publish / discard drafts of homepage sections and pages. */

const SECTION_COLUMNS = "page, `key`, type, sort_order, is_visible, content";

export async function publish_sections(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "content.write");
  const page = String(args.p_page ?? "");
  await tx(pool, async (conn) => {
    await exec(conn, "DELETE FROM cms_sections WHERE page = ? AND state = 'published'", [page]);
    await exec(
      conn,
      `INSERT INTO cms_sections (id, ${SECTION_COLUMNS}, state, updated_by, published_at)
       SELECT UUID(), ${SECTION_COLUMNS}, 'published', ?, UTC_TIMESTAMP(3) FROM cms_sections WHERE page = ? AND state = 'draft'`,
      [actorId(ctx), page],
    );
  });
  return null;
}

export async function discard_section_drafts(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "content.write");
  const page = String(args.p_page ?? "");
  await tx(pool, async (conn) => {
    await exec(conn, "DELETE FROM cms_sections WHERE page = ? AND state = 'draft'", [page]);
    await exec(
      conn,
      `INSERT INTO cms_sections (id, ${SECTION_COLUMNS}, state, updated_by)
       SELECT UUID(), ${SECTION_COLUMNS}, 'draft', ? FROM cms_sections WHERE page = ? AND state = 'published'`,
      [actorId(ctx), page],
    );
  });
  return null;
}

export async function publish_cms_page(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "content.write");
  const groupId = String(args.p_group_id ?? "");
  await tx(pool, async (conn) => {
    const draft = await one(conn, "SELECT * FROM cms_pages WHERE group_id = ? AND state = 'draft' FOR UPDATE", [groupId]);
    if (!draft) raise("DRAFT_NOT_FOUND");
    const published = await one(conn, "SELECT published_at FROM cms_pages WHERE group_id = ? AND state = 'published' FOR UPDATE", [groupId]);
    await exec(conn, "DELETE FROM cms_pages WHERE group_id = ? AND state = 'published'", [groupId]);
    await insertRow(conn, "cms_pages", {
      group_id: draft.group_id,
      kind: draft.kind,
      state: "published",
      slug: draft.slug,
      title: draft.title,
      excerpt: draft.excerpt,
      body_md: draft.body_md,
      cover_image_url: draft.cover_image_url,
      cover_image_alt: draft.cover_image_alt,
      author_name: draft.author_name,
      seo_title: draft.seo_title,
      seo_description: draft.seo_description,
      requires_owner_review: Number(draft.requires_owner_review) === 1,
      published_at: published?.published_at ? `${String(published.published_at).replace(" ", "T")}Z` : new Date().toISOString(),
      updated_by: actorId(ctx),
    });
  });
  return null;
}

export async function unpublish_cms_page(ctx: DbContext, args: Record<string, unknown>, pool: Pool) {
  requirePerm(ctx, "content.write");
  await exec(pool, "DELETE FROM cms_pages WHERE group_id = ? AND state = 'published'", [String(args.p_group_id ?? "")]);
  return null;
}
