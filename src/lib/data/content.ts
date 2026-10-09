import "server-only";
import { cache } from "react";
import { draftMode } from "next/headers";
import { getPublicDb, getUserDb } from "@/lib/db/client";
import { getStaffAccess } from "@/lib/auth/session";
import { logError } from "@/lib/monitoring";
import { isSectionType, parseSectionContent, type HomeSection } from "@/lib/cms/sections";

/**
 * Preview mode is ON only when Next.js draft mode is enabled AND the visitor
 * is a staff member allowed to edit content. Drafts are additionally protected
 * by row level security, so they can never leak to the public.
 */
export const isPreview = cache(async (): Promise<boolean> => {
  const draft = await draftMode();
  if (!draft.isEnabled) return false;
  const access = await getStaffAccess();
  return !!access?.permissions.has("content.write");
});

async function contentClient(preview: boolean) {
  return preview ? await getUserDb() : getPublicDb();
}

export const getHomeSections = cache(async (): Promise<HomeSection[]> => {
  const preview = await isPreview();
  const db = await contentClient(preview);
  if (!db) return [];
  let query = db
    .from("cms_sections")
    .select("id, key, type, sort_order, is_visible, content")
    .eq("page", "home")
    .eq("state", preview ? "draft" : "published")
    .order("sort_order");
  if (!preview) query = query.eq("is_visible", true);
  const { data, error } = await query;
  if (error) {
    logError("content.sections", error);
    return [];
  }
  return (data ?? [])
    .filter((row) => row.is_visible && isSectionType(row.type))
    .map(
      (row) =>
        ({
          id: row.id,
          key: row.key,
          type: row.type,
          sortOrder: row.sort_order,
          isVisible: row.is_visible,
          content: parseSectionContent(row.type as never, row.content),
        }) as HomeSection,
    );
});

export type CmsPage = {
  id: string;
  group_id: string;
  kind: "page" | "policy" | "post";
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  author_name: string | null;
  seo_title: string | null;
  seo_description: string | null;
  requires_owner_review: boolean;
  published_at: string | null;
  updated_at: string;
};

const PAGE_SELECT =
  "id, group_id, kind, slug, title, excerpt, body_md, cover_image_url, cover_image_alt, author_name, seo_title, seo_description, requires_owner_review, published_at, updated_at";

export const getCmsPage = cache(async (kind: CmsPage["kind"], slug: string): Promise<CmsPage | null> => {
  const preview = await isPreview();
  const db = await contentClient(preview);
  if (!db) return null;
  const { data, error } = await db
    .from("cms_pages")
    .select(PAGE_SELECT)
    .eq("kind", kind)
    .eq("slug", slug)
    .eq("state", preview ? "draft" : "published")
    .maybeSingle();
  if (error) logError("content.page", error, { kind, slug });
  return (data as CmsPage | null) ?? null;
});

export const listCmsPages = cache(async (kind: CmsPage["kind"]): Promise<CmsPage[]> => {
  const db = getPublicDb();
  if (!db) return [];
  const { data, error } = await db
    .from("cms_pages")
    .select(PAGE_SELECT)
    .eq("kind", kind)
    .eq("state", "published")
    .order("published_at", { ascending: false });
  if (error) {
    logError("content.pages", error, { kind });
    return [];
  }
  return (data as CmsPage[]) ?? [];
});

export type Faq = { id: string; question: string; answer_md: string; category: string; show_on_home: boolean };

export const getFaqs = cache(async (): Promise<Faq[]> => {
  const db = getPublicDb();
  if (!db) return [];
  const { data, error } = await db
    .from("faqs")
    .select("id, question, answer_md, category, show_on_home")
    .eq("is_published", true)
    .order("sort_order");
  if (error) {
    logError("content.faqs", error);
    return [];
  }
  return data ?? [];
});

export type Banner = {
  id: string;
  placement: string;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  image_alt: string | null;
};

/** Active banners. Scheduling (start/end dates) is enforced by RLS. */
export const getBanners = cache(async (placement: "announcement" | "home_promo" | "shop_top"): Promise<Banner[]> => {
  const db = getPublicDb();
  if (!db) return [];
  const { data, error } = await db
    .from("banners")
    .select("id, placement, title, body, cta_label, cta_url, image_url, image_alt")
    .eq("placement", placement)
    .order("sort_order");
  if (error) {
    logError("content.banners", error);
    return [];
  }
  return data ?? [];
});

export type InstagramPost = { id: string; image_url: string; image_alt: string; permalink: string; caption: string | null };

export const getInstagramPosts = cache(async (): Promise<InstagramPost[]> => {
  const db = getPublicDb();
  if (!db) return [];
  const { data, error } = await db
    .from("instagram_posts")
    .select("id, image_url, image_alt, permalink, caption")
    .eq("is_published", true)
    .order("sort_order")
    .limit(8);
  if (error) {
    logError("content.instagram", error);
    return [];
  }
  return data ?? [];
});
