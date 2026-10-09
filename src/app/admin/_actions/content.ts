"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { check, runAdminAction, UserFacingError, type ActionResult } from "@/lib/admin/action";
import { logAdminAction } from "@/lib/audit";
import { revalidateStorefront } from "@/lib/cache";
import { isSectionType, SECTION_TYPES } from "@/lib/cms/sections";
import { linkSchema, slugSchema } from "@/lib/validation/common";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

// ---------------------------------------------------------------------------
// Homepage sections (edited as a draft, then published in one go)
// ---------------------------------------------------------------------------
const sectionInput = z.object({
  key: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  type: z.string().refine(isSectionType, "Unknown section type"),
  is_visible: z.boolean(),
  content: z.record(z.string(), z.unknown()),
});

export async function saveHomeDraftAction(input: unknown): Promise<ActionResult> {
  return runAdminAction("content.write", async ({ db, user }) => {
    const sections = z.array(sectionInput).max(30).parse(input);
    const keys = sections.map((s) => s.key);
    if (new Set(keys).size !== keys.length) throw new UserFacingError("Two sections have the same key.");
    const rows = sections.map((s, i) => {
      const def = SECTION_TYPES[s.type as keyof typeof SECTION_TYPES];
      const parsed = (def.schema as z.ZodType).safeParse(s.content);
      if (!parsed.success) throw new UserFacingError(`Please check the “${def.label}” section.`);
      return { page: "home", key: s.key, type: s.type, state: "draft", sort_order: (i + 1) * 10, is_visible: s.is_visible, content: parsed.data as never, updated_by: user.id };
    });
    check(await db.from("cms_sections").delete().eq("page", "home").eq("state", "draft"));
    if (rows.length) check(await db.from("cms_sections").insert(rows));
    await logAdminAction({ action: "content.home.save_draft", entityType: "cms_sections", entityId: "home", summary: "Saved homepage draft" });
    revalidatePath("/admin/content");
    return { ok: true, message: "Draft saved. Use Preview to check it, then Publish." };
  });
}

export async function publishHomeAction(): Promise<ActionResult> {
  return runAdminAction("content.write", async ({ db }) => {
    check(await db.rpc("publish_sections", { p_page: "home" }), "Could not publish.");
    await logAdminAction({ action: "content.home.publish", entityType: "cms_sections", entityId: "home", summary: "Published the homepage" });
    revalidateStorefront();
    revalidatePath("/admin/content");
    return { ok: true, message: "Homepage published — it is live now." };
  });
}

export async function discardHomeDraftAction(): Promise<ActionResult> {
  return runAdminAction("content.write", async ({ db }) => {
    check(await db.rpc("discard_section_drafts", { p_page: "home" }));
    await logAdminAction({ action: "content.home.discard", entityType: "cms_sections", entityId: "home", summary: "Discarded homepage draft" });
    revalidatePath("/admin/content");
    return { ok: true, message: "Draft discarded — back to the live version." };
  });
}

// ---------------------------------------------------------------------------
// Pages, policies and journal posts (draft + published copies per group)
// ---------------------------------------------------------------------------
const pageSchema = z.object({
  group_id: z.uuid().optional(),
  kind: z.enum(["page", "policy", "post"]),
  slug: slugSchema,
  title: z.string().trim().min(1, "Enter a title").max(160),
  excerpt: optText(400),
  body_md: z.string().max(60000),
  cover_image_url: optText(500),
  cover_image_alt: optText(200),
  author_name: optText(80),
  seo_title: optText(120),
  seo_description: optText(300),
  requires_owner_review: z.boolean(),
  publish: z.boolean(),
});

export type PagePayload = z.input<typeof pageSchema>;

export async function savePageAction(input: PagePayload): Promise<ActionResult<string>> {
  return runAdminAction("content.write", async ({ db, access, user }) => {
    const { publish, group_id, ...p } = pageSchema.parse(input);
    if (p.cover_image_url && !p.cover_image_alt) throw new UserFacingError("Describe the cover image (alt text).");

    let groupId = group_id;
    let wasUnderReview = true;
    if (groupId) {
      const { data: existing } = check(await db.from("cms_pages").select("requires_owner_review, kind").eq("group_id", groupId).eq("state", "draft").maybeSingle());
      if (!existing) throw new UserFacingError("This page no longer exists.");
      wasUnderReview = existing.requires_owner_review;
    }
    // Only the owner can sign off legal text as reviewed.
    if (p.kind === "policy" && wasUnderReview && !p.requires_owner_review && access.role !== "owner") {
      throw new UserFacingError("Only the store owner can mark a policy as reviewed.");
    }

    const row = { ...p, updated_by: user.id };
    if (groupId) {
      check(await db.from("cms_pages").update(row).eq("group_id", groupId).eq("state", "draft"), "Could not save. Is the web address already used?");
    } else {
      const { data } = check(
        await db.from("cms_pages").insert({ ...row, state: "draft" }).select("group_id").single(),
        "Could not create the page. Is the web address already used?",
      );
      groupId = data!.group_id;
    }

    if (publish) {
      const { error } = await db.rpc("publish_cms_page", { p_group_id: groupId });
      if (error) throw new UserFacingError(error.code === "23505" ? "Another live page already uses this web address." : "Saved, but could not publish.");
    }
    await logAdminAction({
      action: publish ? "content.page.publish" : "content.page.save",
      entityType: "cms_page",
      entityId: groupId!,
      summary: `${publish ? "Published" : "Saved draft of"} ${p.kind} “${p.title}”${p.kind === "policy" && wasUnderReview && !p.requires_owner_review ? " (marked as owner-reviewed)" : ""}`,
    });
    if (publish) revalidateStorefront();
    revalidatePath("/admin/content/pages");
    revalidatePath("/admin/content/posts");
    return { ok: true, message: publish ? "Published — it is live now." : "Draft saved.", data: groupId };
  });
}

export async function unpublishPageAction(groupId: string): Promise<ActionResult> {
  return runAdminAction("content.write", async ({ db }) => {
    z.uuid().parse(groupId);
    check(await db.rpc("unpublish_cms_page", { p_group_id: groupId }));
    await logAdminAction({ action: "content.page.unpublish", entityType: "cms_page", entityId: groupId, summary: "Unpublished a page" });
    revalidateStorefront();
    revalidatePath("/admin/content/pages");
    revalidatePath("/admin/content/posts");
    return { ok: true, message: "Unpublished — the page is hidden from the website." };
  });
}

export async function deletePageAction(groupId: string): Promise<ActionResult> {
  return runAdminAction("content.write", async ({ db }) => {
    z.uuid().parse(groupId);
    const { data } = check(await db.from("cms_pages").select("kind, title").eq("group_id", groupId).limit(1).single());
    if (data!.kind === "policy") throw new UserFacingError("Policies can’t be deleted (checkout links to them). Unpublish it instead.");
    check(await db.from("cms_pages").delete().eq("group_id", groupId));
    await logAdminAction({ action: "content.page.delete", entityType: "cms_page", entityId: groupId, summary: `Deleted “${data!.title}”` });
    revalidateStorefront();
    revalidatePath("/admin/content/pages");
    revalidatePath("/admin/content/posts");
    return { ok: true, message: "Deleted." };
  });
}

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------
const faqSchema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  question: z.string().trim().min(3, "Enter the question").max(300),
  answer_md: z.string().trim().min(1, "Enter the answer").max(4000),
  category: z.string().trim().min(1).max(60).default("General"),
  sort_order: z.coerce.number().int().min(0).max(9999),
  is_published: z.boolean(),
  show_on_home: z.boolean(),
});

export async function saveFaqAction(formData: FormData): Promise<ActionResult> {
  return runAdminAction("content.write", async ({ db }) => {
    const { id, ...f } = faqSchema.parse({
      id: formData.get("id") ?? "",
      question: formData.get("question"),
      answer_md: formData.get("answer_md"),
      category: formData.get("category") || "General",
      sort_order: formData.get("sort_order") ?? 0,
      is_published: formData.get("is_published") === "on",
      show_on_home: formData.get("show_on_home") === "on",
    });
    if (id) check(await db.from("faqs").update(f).eq("id", id));
    else check(await db.from("faqs").insert(f));
    await logAdminAction({ action: "content.faq.save", entityType: "faq", entityId: id ?? null, summary: `Saved FAQ “${f.question.slice(0, 60)}”` });
    revalidateStorefront();
    revalidatePath("/admin/content/faqs");
    return { ok: true, message: "FAQ saved." };
  });
}

export async function deleteFaqAction(id: string): Promise<ActionResult> {
  return runAdminAction("content.write", async ({ db }) => {
    z.uuid().parse(id);
    check(await db.from("faqs").delete().eq("id", id));
    await logAdminAction({ action: "content.faq.delete", entityType: "faq", entityId: id, summary: "Deleted an FAQ" });
    revalidateStorefront();
    revalidatePath("/admin/content/faqs");
    return { ok: true, message: "FAQ deleted." };
  });
}

// ---------------------------------------------------------------------------
// Banners (announcement bar, homepage promo, shop top)
// ---------------------------------------------------------------------------
const dateTime = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    // <input type="datetime-local"> has no timezone: treat it as India time.
    const d = new Date(`${v}:00+05:30`);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d.toISOString();
  });

const bannerSchema = z
  .object({
    id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    placement: z.enum(["announcement", "home_promo", "shop_top"]),
    title: z.string().trim().min(1, "Enter the banner text").max(160),
    body: optText(400),
    cta_label: optText(40),
    cta_url: linkSchema.optional().transform((v) => v || null),
    image_url: optText(500),
    image_alt: optText(200),
    starts_at: dateTime,
    ends_at: dateTime,
    is_active: z.boolean(),
    sort_order: z.coerce.number().int().min(0).max(9999),
  })
  .refine((b) => !b.starts_at || !b.ends_at || b.starts_at < b.ends_at, { path: ["ends_at"], message: "End must be after start" })
  .refine((b) => !b.image_url || !!b.image_alt, { path: ["image_alt"], message: "Describe the image" });

export async function saveBannerAction(formData: FormData): Promise<ActionResult> {
  return runAdminAction("content.write", async ({ db }) => {
    const { id, ...b } = bannerSchema.parse({
      id: formData.get("id") ?? "",
      placement: formData.get("placement"),
      title: formData.get("title"),
      body: formData.get("body") ?? "",
      cta_label: formData.get("cta_label") ?? "",
      cta_url: formData.get("cta_url") ?? "",
      image_url: formData.get("image_url") ?? "",
      image_alt: formData.get("image_alt") ?? "",
      starts_at: formData.get("starts_at") ?? "",
      ends_at: formData.get("ends_at") ?? "",
      is_active: formData.get("is_active") === "on",
      sort_order: formData.get("sort_order") ?? 0,
    });
    if (id) check(await db.from("banners").update(b).eq("id", id));
    else check(await db.from("banners").insert(b));
    await logAdminAction({ action: "content.banner.save", entityType: "banner", entityId: id ?? null, summary: `Saved banner “${b.title.slice(0, 60)}”` });
    revalidateStorefront();
    revalidatePath("/admin/content/banners");
    return { ok: true, message: b.is_active ? "Banner saved and switched on." : "Banner saved (switched off)." };
  });
}

export async function deleteBannerAction(id: string): Promise<ActionResult> {
  return runAdminAction("content.write", async ({ db }) => {
    z.uuid().parse(id);
    check(await db.from("banners").delete().eq("id", id));
    await logAdminAction({ action: "content.banner.delete", entityType: "banner", entityId: id, summary: "Deleted a banner" });
    revalidateStorefront();
    revalidatePath("/admin/content/banners");
    return { ok: true, message: "Banner deleted." };
  });
}

// ---------------------------------------------------------------------------
// Instagram posts (added manually: no Instagram login or API key needed)
// ---------------------------------------------------------------------------
const instagramSchema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  image_url: z.string().trim().min(1, "Choose an image").max(500),
  image_alt: z.string().trim().min(1, "Describe the image").max(200),
  permalink: z
    .string()
    .trim()
    .regex(/^https:\/\/(www\.)?instagram\.com\/[\w./?=&-]+$/i, "Paste the link to the post, starting with https://www.instagram.com/"),
  caption: optText(300),
  is_published: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(9999),
});

export async function saveInstagramAction(formData: FormData): Promise<ActionResult> {
  return runAdminAction("content.write", async ({ db }) => {
    const { id, ...post } = instagramSchema.parse({
      id: formData.get("id") ?? "",
      image_url: formData.get("image_url") ?? "",
      image_alt: formData.get("image_alt") ?? "",
      permalink: formData.get("permalink") ?? "",
      caption: formData.get("caption") ?? "",
      is_published: formData.get("is_published") === "on",
      sort_order: formData.get("sort_order") ?? 0,
    });
    if (id) check(await db.from("instagram_posts").update(post).eq("id", id));
    else check(await db.from("instagram_posts").insert(post));
    await logAdminAction({ action: "content.instagram.save", entityType: "instagram_post", entityId: id ?? null, summary: "Saved an Instagram post" });
    revalidateStorefront();
    revalidatePath("/admin/content/instagram");
    return { ok: true, message: "Saved." };
  });
}

export async function deleteInstagramAction(id: string): Promise<ActionResult> {
  return runAdminAction("content.write", async ({ db }) => {
    z.uuid().parse(id);
    check(await db.from("instagram_posts").delete().eq("id", id));
    await logAdminAction({ action: "content.instagram.delete", entityType: "instagram_post", entityId: id, summary: "Deleted an Instagram post" });
    revalidateStorefront();
    revalidatePath("/admin/content/instagram");
    return { ok: true, message: "Deleted." };
  });
}
