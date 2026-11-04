"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { check, runAdminAction, UserFacingError, type ActionResult } from "@/lib/admin/action";
import { logAdminAction } from "@/lib/audit";
import { revalidateStorefront } from "@/lib/cache";
import { rupeesToPaise } from "@/lib/money";
import { randomToken } from "@/lib/security/tokens";
import { slugSchema } from "@/lib/validation/common";

const label = z.object({ label: z.string().trim().min(1).max(80), approved: z.boolean() });
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const productSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(2, "Enter a product name").max(160),
  short_title: opt(80),
  subtitle: opt(120),
  slug: slugSchema,
  status: z.enum(["draft", "published", "archived"]),
  short_description: opt(400),
  description_md: z.string().max(20000).default(""),
  ingredients: opt(2000),
  allergens: opt(1000),
  dietary_mark: z.enum(["", "vegetarian"]).transform((v) => v || null),
  nutrition: z.array(z.object({ nutrient: z.string().trim().min(1).max(60), per_100g: z.string().trim().min(1).max(40) })).max(30),
  nutrition_note: opt(300),
  claims: z.array(label).max(20),
  benefits: z.array(label).max(20),
  storage_instructions: opt(500),
  shelf_life: opt(200),
  shelf_life_approved: z.boolean(),
  shipping_returns_md: opt(4000),
  manufacturer_info: opt(600),
  fssai_license: opt(40),
  hsn_code: z
    .string()
    .trim()
    .max(10)
    .refine((v) => v === "" || /^\d{4,8}$/.test(v), "HSN code should be 4–8 digits")
    .transform((v) => v || null),
  gst_rate: z
    .string()
    .trim()
    .refine((v) => v === "" || ["0", "0.25", "3", "5", "12", "18", "28", "40"].includes(v), "Choose a valid GST rate")
    .transform((v) => (v === "" ? null : Number(v))),
  is_featured: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(9999),
  seo_title: opt(120),
  seo_description: opt(300),
  og_image_url: opt(500),
  category_ids: z.array(z.uuid()).max(20),
  variants: z
    .array(
      z.object({
        id: z.uuid().optional(),
        title: z.string().trim().min(1, "Enter a size, e.g. 100 g").max(80),
        sku: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9._-]{2,64}$/, "SKU: letters, numbers, - . _ only"),
        barcode: opt(64),
        weight_grams: z.coerce.number().int().min(0).max(100000),
        mrp: z.string(),
        price: z.string(),
        low_stock_threshold: z.coerce.number().int().min(0).max(100000),
        is_active: z.boolean(),
      }),
    )
    .min(1, "Add at least one variant")
    .max(20),
  images: z
    .array(
      z.object({
        id: z.uuid().optional(),
        url: z.string().trim().min(1).max(500),
        alt: z.string().trim().max(240),
        kind: z.enum(["packshot", "photo", "front_label", "back_label", "lifestyle", "other"]),
        width: z.number().int().positive().nullable(),
        height: z.number().int().positive().nullable(),
      }),
    )
    .max(30),
});

export type ProductPayload = z.input<typeof productSchema>;

export async function saveProductAction(payload: ProductPayload): Promise<ActionResult> {
  return runAdminAction("products.write", async ({ db }) => {
    const p = productSchema.parse(payload);

    const variants = p.variants.map((v, i) => {
      const mrp = rupeesToPaise(v.mrp);
      const price = rupeesToPaise(v.price);
      if (mrp === null || price === null) throw new UserFacingError(`Enter valid prices for “${v.title}”.`);
      if (price > mrp) throw new UserFacingError(`Selling price can't be higher than MRP for “${v.title}”.`);
      return { ...v, mrp_paise: mrp, price_paise: price, sort_order: i + 1 };
    });
    const skus = variants.map((v) => v.sku.toUpperCase());
    if (new Set(skus).size !== skus.length) throw new UserFacingError("Each variant needs a different SKU.");

    if (p.status === "published") {
      if (!variants.some((v) => v.is_active && v.price_paise > 0)) throw new UserFacingError("Add an active variant with a price before publishing.");
      if (p.images.length === 0) throw new UserFacingError("Add at least one image before publishing.");
      if (p.images.some((i) => !i.alt)) throw new UserFacingError("Add a description (alt text) to every image before publishing.");
    }

    const { data: current } = check(await db.from("products").select("published_at, status").eq("id", p.id).single());

    check(
      await db
        .from("products")
        .update({
          title: p.title,
          short_title: p.short_title,
          subtitle: p.subtitle,
          slug: p.slug,
          status: p.status,
          short_description: p.short_description,
          description_md: p.description_md,
          ingredients: p.ingredients,
          allergens: p.allergens,
          dietary_mark: p.dietary_mark,
          nutrition: p.nutrition,
          nutrition_note: p.nutrition_note,
          claims: p.claims,
          benefits: p.benefits,
          storage_instructions: p.storage_instructions,
          shelf_life: p.shelf_life,
          shelf_life_approved: p.shelf_life_approved,
          shipping_returns_md: p.shipping_returns_md,
          manufacturer_info: p.manufacturer_info,
          fssai_license: p.fssai_license,
          hsn_code: p.hsn_code,
          gst_rate: p.gst_rate,
          is_featured: p.is_featured,
          sort_order: p.sort_order,
          seo_title: p.seo_title,
          seo_description: p.seo_description,
          og_image_url: p.og_image_url,
          published_at: p.status === "published" ? (current?.published_at ?? new Date().toISOString()) : current?.published_at ?? null,
        })
        .eq("id", p.id),
      "Could not save the product. The web address (slug) may already be used by another product.",
    );

    // Collections
    check(await db.from("product_categories").delete().eq("product_id", p.id));
    if (p.category_ids.length) {
      check(await db.from("product_categories").insert(p.category_ids.map((category_id) => ({ product_id: p.id, category_id }))));
    }

    // Variants (stock is managed in Inventory, never here)
    const { data: existingVariants } = check(await db.from("product_variants").select("id").eq("product_id", p.id));
    const keepIds = new Set(variants.filter((v) => v.id).map((v) => v.id!));
    const toDelete = (existingVariants ?? []).filter((v) => !keepIds.has(v.id)).map((v) => v.id);
    if (toDelete.length) check(await db.from("product_variants").delete().in("id", toDelete));
    for (const v of variants) {
      const row = {
        title: v.title,
        sku: v.sku,
        barcode: v.barcode,
        weight_grams: v.weight_grams,
        mrp_paise: v.mrp_paise,
        price_paise: v.price_paise,
        low_stock_threshold: v.low_stock_threshold,
        is_active: v.is_active,
        sort_order: v.sort_order,
      };
      if (v.id) check(await db.from("product_variants").update(row).eq("id", v.id).eq("product_id", p.id), `Could not save variant ${v.sku} (is the SKU already used?).`);
      else check(await db.from("product_variants").insert({ ...row, product_id: p.id, stock: 0 }), `Could not add variant ${v.sku} (is the SKU already used?).`);
    }

    // Images (order = position in the list)
    const { data: existingImages } = check(await db.from("product_images").select("id").eq("product_id", p.id));
    const keepImages = new Set(p.images.filter((i) => i.id).map((i) => i.id!));
    const removeImages = (existingImages ?? []).filter((i) => !keepImages.has(i.id)).map((i) => i.id);
    if (removeImages.length) check(await db.from("product_images").delete().in("id", removeImages));
    for (const [index, img] of p.images.entries()) {
      const row = { url: img.url, alt: img.alt, kind: img.kind, width: img.width, height: img.height, sort_order: index + 1 };
      if (img.id) check(await db.from("product_images").update(row).eq("id", img.id).eq("product_id", p.id));
      else check(await db.from("product_images").insert({ ...row, product_id: p.id }));
    }

    await logAdminAction({
      action: "product.save",
      entityType: "product",
      entityId: p.id,
      summary: `Saved “${p.title}” (${p.status})${current?.status !== p.status ? `, status ${current?.status} → ${p.status}` : ""}`,
    });
    revalidateStorefront();
    revalidatePath("/admin/products");
    return { ok: true, message: p.status === "published" ? "Saved and live on the website." : "Saved." };
  });
}

export async function duplicateProductAction(productId: string): Promise<ActionResult<string>> {
  return runAdminAction("products.write", async ({ db }) => {
    z.uuid().parse(productId);
    const { data: src } = check(
      await db
        .from("products")
        .select("*, product_variants(*), product_images(*), product_categories(category_id)")
        .eq("id", productId)
        .single(),
    );
    const suffix = randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "x");
    const { id: _id, created_at: _c, updated_at: _u, published_at: _p, product_variants, product_images, product_categories, ...rest } = src!;
    void _id;
    void _c;
    void _u;
    void _p;
    const { data: copy } = check(
      await db
        .from("products")
        .insert({ ...rest, title: `${src!.title} (copy)`, slug: `${src!.slug}-copy-${suffix}`.slice(0, 120), status: "draft", is_featured: false })
        .select("id")
        .single(),
    );
    for (const v of product_variants ?? []) {
      check(
        await db.from("product_variants").insert({
          product_id: copy!.id,
          title: v.title,
          sku: `${v.sku}-COPY-${suffix.toUpperCase()}`.slice(0, 64),
          barcode: null,
          weight_grams: v.weight_grams,
          mrp_paise: v.mrp_paise,
          price_paise: v.price_paise,
          stock: 0,
          low_stock_threshold: v.low_stock_threshold,
          is_active: v.is_active,
          sort_order: v.sort_order,
        }),
      );
    }
    if ((product_images ?? []).length) {
      check(
        await db.from("product_images").insert(
          product_images.map((i) => ({ product_id: copy!.id, url: i.url, alt: i.alt, kind: i.kind, width: i.width, height: i.height, sort_order: i.sort_order })),
        ),
      );
    }
    if ((product_categories ?? []).length) {
      check(await db.from("product_categories").insert(product_categories.map((c) => ({ product_id: copy!.id, category_id: c.category_id }))));
    }
    await logAdminAction({ action: "product.duplicate", entityType: "product", entityId: copy!.id, summary: `Duplicated “${src!.title}”` });
    revalidatePath("/admin/products");
    return { ok: true, message: "Copy created as a draft (stock 0, barcode cleared).", data: copy!.id };
  });
}

export async function setProductStatusAction(productId: string, status: "draft" | "published" | "archived"): Promise<ActionResult> {
  return runAdminAction("products.write", async ({ db }) => {
    z.uuid().parse(productId);
    const { data: product } = check(
      await db.from("products").select("title, published_at, product_images(id), product_variants(id, is_active, price_paise)").eq("id", productId).single(),
    );
    if (status === "published") {
      if (!(product!.product_images ?? []).length) throw new UserFacingError("Add at least one image before publishing.");
      if (!(product!.product_variants ?? []).some((v) => v.is_active && v.price_paise > 0)) throw new UserFacingError("Set a price before publishing.");
    }
    check(
      await db
        .from("products")
        .update({ status, published_at: status === "published" ? (product!.published_at ?? new Date().toISOString()) : product!.published_at })
        .eq("id", productId),
    );
    await logAdminAction({ action: "product.status", entityType: "product", entityId: productId, summary: `“${product!.title}” → ${status}` });
    revalidateStorefront();
    revalidatePath("/admin/products");
    return { ok: true, message: status === "published" ? "Published." : status === "archived" ? "Archived (hidden from the shop)." : "Moved to drafts." };
  });
}

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  return runAdminAction("products.write", async ({ db }) => {
    z.uuid().parse(productId);
    const { data: product } = check(await db.from("products").select("title, status").eq("id", productId).single());
    if (product!.status === "published") throw new UserFacingError("Archive or unpublish the product before deleting it.");
    check(await db.from("products").delete().eq("id", productId), "Could not delete the product.");
    await logAdminAction({ action: "product.delete", entityType: "product", entityId: productId, summary: `Deleted “${product!.title}”` });
    revalidateStorefront();
    revalidatePath("/admin/products");
    return { ok: true, message: "Product deleted. Past orders keep their own copy of the product details." };
  });
}

// ---------------------------------------------------------------------------
// Collections (categories)
// ---------------------------------------------------------------------------
const categorySchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Enter a name").max(80),
  slug: slugSchema,
  description: z.string().trim().max(500).optional(),
  sort_order: z.coerce.number().int().min(0).max(9999),
  is_active: z.boolean(),
});

export async function saveCategoryAction(formData: FormData): Promise<ActionResult> {
  return runAdminAction("products.write", async ({ db }) => {
    const c = categorySchema.parse({
      id: formData.get("id") ?? "",
      name: formData.get("name"),
      slug: formData.get("slug"),
      description: formData.get("description") ?? "",
      sort_order: formData.get("sort_order") ?? 0,
      is_active: formData.get("is_active") === "on",
    });
    const row = { name: c.name, slug: c.slug, description: c.description || null, sort_order: c.sort_order, is_active: c.is_active };
    if (c.id) check(await db.from("categories").update(row).eq("id", c.id));
    else check(await db.from("categories").insert(row));
    await logAdminAction({ action: "collection.save", entityType: "category", entityId: c.id || null, summary: `Saved collection “${c.name}”` });
    revalidateStorefront();
    revalidatePath("/admin/products/collections");
    return { ok: true, message: "Collection saved." };
  });
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  return runAdminAction("products.write", async ({ db }) => {
    z.uuid().parse(id);
    check(await db.from("categories").delete().eq("id", id));
    await logAdminAction({ action: "collection.delete", entityType: "category", entityId: id, summary: "Deleted a collection" });
    revalidateStorefront();
    revalidatePath("/admin/products/collections");
    return { ok: true, message: "Collection deleted." };
  });
}

// ---------------------------------------------------------------------------
// Quick "Add product" page and bulk actions on the product list
// ---------------------------------------------------------------------------
const quickProductSchema = z.object({
  title: z.string().trim().min(2, "Enter a product name").max(160),
  short_description: z.string().trim().max(400).default(""),
  size: z.string().trim().min(1, "Enter a size, e.g. 100 g").max(80),
  price: z.string().trim(),
  mrp: z.string().trim(),
  weight_grams: z.coerce.number().int().min(0).max(100000),
  stock: z.coerce.number().int().min(0, "Stock can't be negative").max(1_000_000),
  sku: z.string().trim().max(64).default(""),
  publish: z.boolean(),
  category_ids: z.array(z.uuid()).max(50).default([]),
  images: z
    .array(z.object({ url: z.string().trim().min(1).max(500), width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable() }))
    .max(20)
    .default([]),
});
export type QuickProductInput = z.input<typeof quickProductSchema>;

/** Creates a complete product in one step: name, photos, price, size and opening stock. */
export async function createQuickProductAction(input: QuickProductInput): Promise<ActionResult<string>> {
  return runAdminAction("products.write", async ({ db }) => {
    const parsed = quickProductSchema.safeParse(input);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
      return { ok: false, message: "Please check the highlighted fields.", errors };
    }
    const p = parsed.data;
    const price = rupeesToPaise(p.price);
    const mrpInput = p.mrp === "" ? p.price : p.mrp;
    const mrp = rupeesToPaise(mrpInput);
    const errors: Record<string, string> = {};
    if (price === null || price <= 0) errors.price = "Enter the selling price, e.g. 149";
    if (mrp === null) errors.mrp = "Enter the MRP as a number, e.g. 160";
    else if (price !== null && price > mrp) errors.mrp = "MRP can't be lower than the selling price";
    if (p.publish && p.images.length === 0) errors.images = "Add at least one photo to publish, or save as a draft.";
    if (Object.keys(errors).length) return { ok: false, message: "Please check the highlighted fields.", errors };

    const suffix = randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, "x");
    const base = slugSchema.safeParse(p.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100));
    const { data: clash } = base.success ? await db.from("products").select("id").eq("slug", base.data).maybeSingle() : { data: null };
    const slug = base.success && !clash ? base.data : `${base.success ? base.data : "product"}-${suffix}`;
    const sku = (p.sku || `${slug.slice(0, 20).toUpperCase()}-${suffix.toUpperCase()}`).toUpperCase();
    const { data: dupSku } = await db.from("product_variants").select("id").eq("sku", sku).maybeSingle();
    if (dupSku) return { ok: false, message: "Please check the highlighted fields.", errors: { sku: "Another product already uses this SKU." } };

    const now = new Date().toISOString();
    const { data: product } = check(
      await db
        .from("products")
        .insert({
          title: p.title,
          slug,
          short_description: p.short_description || null,
          status: p.publish ? "published" : "draft",
          published_at: p.publish ? now : null,
        })
        .select("id")
        .single(),
    );
    const { data: variant } = check(
      await db
        .from("product_variants")
        .insert({ product_id: product!.id, title: p.size, sku, mrp_paise: mrp!, price_paise: price!, weight_grams: p.weight_grams, stock: 0 })
        .select("id")
        .single(),
    );
    if (p.images.length) {
      check(
        await db
          .from("product_images")
          .insert(p.images.map((img, i) => ({ product_id: product!.id, url: img.url, alt: p.title, kind: "packshot", width: img.width, height: img.height, sort_order: i }))),
      );
    }
    if (p.category_ids.length) {
      check(await db.from("product_categories").insert(p.category_ids.map((category_id) => ({ product_id: product!.id, category_id }))));
    }
    if (p.stock > 0) {
      const { error } = await db.rpc("adjust_stock", { p_variant_id: variant!.id, p_delta: p.stock, p_reason: "initial", p_note: "Opening stock" });
      if (error) throw new UserFacingError("The product was created, but the opening stock couldn't be saved. Set it on the product page.");
    }
    await logAdminAction({ action: "product.create", entityType: "product", entityId: product!.id, summary: `Created “${p.title}”${p.publish ? " (live)" : " (draft)"}` });
    revalidateStorefront();
    revalidatePath("/admin/products");
    return { ok: true, message: p.publish ? "Product created and live in the shop." : "Product saved as a draft.", data: product!.id };
  });
}

/** Ticked rows on the product list: publish, move to drafts, archive or delete several at once. */
export async function bulkProductsAction(ids: string[], op: "published" | "draft" | "archived" | "delete"): Promise<ActionResult> {
  const list = z.array(z.uuid()).min(1).max(200).safeParse(ids);
  if (!list.success || !["published", "draft", "archived", "delete"].includes(op)) return { ok: false, message: "Nothing selected." };
  let done = 0;
  const problems: string[] = [];
  for (const id of list.data) {
    const r = op === "delete" ? await deleteProductAction(id) : await setProductStatusAction(id, op);
    if (r.ok) done += 1;
    else if (r.message && !problems.includes(r.message)) problems.push(r.message);
  }
  const verb = op === "delete" ? "deleted" : op === "published" ? "published" : op === "draft" ? "moved to drafts" : "archived";
  if (!done) return { ok: false, message: problems[0] ?? "Nothing was changed." };
  return {
    ok: true,
    message: `${done} product${done === 1 ? "" : "s"} ${verb}.${problems.length ? ` Some were skipped: ${problems.join(" ")}` : ""}`,
  };
}
