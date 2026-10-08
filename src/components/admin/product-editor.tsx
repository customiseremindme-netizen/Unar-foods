"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ExternalLink, GripVertical, ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { saveProductAction, type ProductPayload } from "@/app/admin/_actions/products";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Card, Notice } from "./ui";
import { StickySaveBar, useAdminAction, useUnsavedWarning } from "./forms";
import { MediaPicker, useImageUpload } from "./image-field";
import { formatINR, rupeesToPaise, discountPercent } from "@/lib/money";
import { slugify } from "@/lib/validation/common";
import { cn } from "@/lib/utils";

type ImageKind = "packshot" | "photo" | "front_label" | "back_label" | "lifestyle" | "other";
type LabelItem = { label: string; approved: boolean };

export type EditorProduct = Omit<ProductPayload, "variants" | "images" | "claims" | "benefits" | "nutrition" | "status"> & {
  status: "draft" | "published" | "archived";
  claims: LabelItem[];
  benefits: LabelItem[];
  nutrition: { nutrient: string; per_100g: string }[];
  variants: {
    id?: string;
    title: string;
    sku: string;
    barcode: string;
    weight_grams: number;
    mrp: string;
    price: string;
    low_stock_threshold: number;
    is_active: boolean;
    /** read-only here: stock is changed in Inventory */
    stock: number;
    is_demo_stock: boolean;
  }[];
  images: { id?: string; url: string; alt: string; kind: ImageKind; width: number | null; height: number | null }[];
};

const IMAGE_KINDS: { value: ImageKind; label: string }[] = [
  { value: "packshot", label: "Product image (pack)" },
  { value: "photo", label: "Real photograph" },
  { value: "lifestyle", label: "Lifestyle / styled image" },
  { value: "front_label", label: "Front label artwork" },
  { value: "back_label", label: "Back label artwork" },
  { value: "other", label: "Other" },
];

const GST_RATES = ["", "0", "0.25", "3", "5", "12", "18", "28", "40"];

const SECTIONS = [
  ["basics", "Basics"],
  ["images", "Images"],
  ["pricing", "Sizes & prices"],
  ["label", "Label & nutrition"],
  ["claims", "Claims & benefits"],
  ["storage", "Storage & shelf life"],
  ["shipping", "Shipping & returns"],
  ["tax", "Tax"],
  ["seo", "Search engines"],
] as const;

export function ProductEditor({
  initial,
  categories,
  canWrite,
  gstRegistered,
  siteHost,
}: {
  siteHost: string;
  initial: EditorProduct;
  categories: { id: string; name: string; is_active: boolean }[];
  canWrite: boolean;
  gstRegistered: boolean;
}) {
  const [p, setP] = useState<EditorProduct>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAdminAction();
  const dirty = JSON.stringify(p) !== saved;

  useUnsavedWarning(dirty);

  const set = <K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) => setP((prev) => ({ ...prev, [key]: value }));
  const err = (key: string) => errors[key];

  async function save(status = p.status) {
    const next = { ...p, status };
    const result = await run(() => saveProductAction(next as ProductPayload));
    setErrors(result.errors ?? {});
    if (result.ok) {
      setP(next);
      setSaved(JSON.stringify(next));
    } else if (result.errors) {
      const first = Object.keys(result.errors)[0];
      document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  const unapprovedClaims = [...p.claims, ...p.benefits].filter((c) => c.label.trim() && !c.approved).length;
  const previewHref = p.status === "published" ? `/products/${p.slug}` : `/api/preview?path=${encodeURIComponent(`/products/${p.slug}`)}`;

  return (
    <div className="grid gap-6 pb-28 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-6">
        <nav aria-label="Product sections" className="flex flex-wrap gap-1.5 text-[0.78rem]">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#section-${id}`} className="rounded-full border border-line bg-paper px-3 py-1 hover:border-forest">
              {label}
            </a>
          ))}
        </nav>

        {!canWrite ? <Notice>You can view this product but your role can’t change it.</Notice> : null}

        <fieldset disabled={!canWrite} className="min-w-0 space-y-6">
          <Card id="section-basics" title="Basics" description="The name and description customers see.">
                  <div className="grid gap-4">
              <TextField id="title" label="Product name" value={p.title} onChange={(v) => set("title", v)} error={err("title")} max={160} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="short_title" label="Short name (cards, cart)" value={p.short_title ?? ""} onChange={(v) => set("short_title", v)} max={80} hint="e.g. Banana Chewy — Dry Fruits & Seeds" />
                <TextField id="subtitle" label="Subtitle" value={p.subtitle ?? ""} onChange={(v) => set("subtitle", v)} max={120} hint="Shown under the name, e.g. the flavour line from the pack." />
              </div>
              <div data-field="slug">
                <Label htmlFor="slug">Web address</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.85rem] text-muted">/products/</span>
                  <Input id="slug" value={p.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} className="h-10 max-w-sm flex-1" aria-invalid={!!err("slug") || undefined} />
                  <Button type="button" size="sm" variant="ghost" onClick={() => set("slug", slugify(p.title))}>
                    Make from name
                  </Button>
                </div>
                {initial.status === "published" && p.slug !== initial.slug ? (
                  <p className="mt-1.5 text-[0.78rem] text-danger">Changing the address of a live product breaks old links and search results.</p>
                ) : null}
                <FieldError message={err("slug")} />
              </div>
              <TextAreaField id="short_description" label="Short description" rows={3} value={p.short_description ?? ""} onChange={(v) => set("short_description", v)} max={400} hint="One or two sentences for product cards and search results." />
              <TextAreaField
                id="description_md"
                label="Full description"
                rows={9}
                value={p.description_md ?? ""}
                onChange={(v) => set("description_md", v)}
                max={20000}
                hint="Formatting: **bold**, *italic*, - bullet points, blank line for a new paragraph. Only describe what is true for the product."
              />
            </div>
          </Card>

          <ImagesCard images={p.images} onChange={(images) => set("images", images)} productName={p.title} error={err("images")} />

          <VariantsCard variants={p.variants} onChange={(variants) => set("variants", variants)} errors={errors} />

          <Card id="section-label" title="Label & nutrition" description="Copy these exactly as printed on the pack.">
                  <div className="grid gap-4">
              <TextAreaField id="ingredients" label="Ingredients" rows={3} value={p.ingredients ?? ""} onChange={(v) => set("ingredients", v)} max={2000} />
              <TextAreaField id="allergens" label="Allergen information" rows={2} value={p.allergens ?? ""} onChange={(v) => set("allergens", v)} max={1000} />
              <div className="max-w-xs">
                <Label htmlFor="dietary_mark">Food mark on pack</Label>
                <Select id="dietary_mark" value={p.dietary_mark ?? ""} onChange={(e) => set("dietary_mark", e.target.value as "" | "vegetarian")}>
                  <option value="">None shown</option>
                  <option value="vegetarian">Green dot (vegetarian)</option>
                </Select>
              </div>
              <NutritionTable rows={p.nutrition} onChange={(rows) => set("nutrition", rows)} />
              <TextField id="nutrition_note" label="Nutrition note" value={p.nutrition_note ?? ""} onChange={(v) => set("nutrition_note", v)} max={300} hint="e.g. “Approximate values per 100 g.”" />
              <TextAreaField id="manufacturer_info" label="Manufactured / marketed by" rows={3} value={p.manufacturer_info ?? ""} onChange={(v) => set("manufacturer_info", v)} max={600} />
              <TextField id="fssai_license" label="FSSAI licence number" value={p.fssai_license ?? ""} onChange={(v) => set("fssai_license", v)} max={40} hint="Enter only the number printed on your licence." />
            </div>
          </Card>

          <Card
            id="section-claims"
            title="Claims & benefits"
            description="Health and quality statements are only shown on the website after you tick “Approved”. Only approve statements you can support."
           
          >
                  {unapprovedClaims > 0 ? (
              <div className="mb-4">
                <Notice tone="warning">
                  {unapprovedClaims} statement{unapprovedClaims === 1 ? " is" : "s are"} waiting for your approval and hidden from customers.
                </Notice>
              </div>
            ) : null}
            <div className="grid gap-6 md:grid-cols-2">
              <LabelList title="Claims (badges)" items={p.claims} onChange={(v) => set("claims", v)} placeholder="e.g. No added sugar" />
              <LabelList title="Benefits (bullet points)" items={p.benefits} onChange={(v) => set("benefits", v)} placeholder="e.g. A handy snack for the day" />
            </div>
          </Card>

          <Card id="section-storage" title="Storage & shelf life">
                  <div className="grid gap-4">
              <TextAreaField id="storage_instructions" label="Storage instructions" rows={2} value={p.storage_instructions ?? ""} onChange={(v) => set("storage_instructions", v)} max={500} />
              <TextField id="shelf_life" label="Shelf life / best before" value={p.shelf_life ?? ""} onChange={(v) => set("shelf_life", v)} max={200} />
              <Checkbox
                checked={p.shelf_life_approved}
                onChange={(e) => set("shelf_life_approved", e.target.checked)}
                label="Approved — show the shelf life on the website"
                description="Leave unticked until you have confirmed it from testing or your label."
              />
            </div>
          </Card>

          <Card id="section-shipping" title="Shipping & returns" description="Leave empty to use the store-wide text from Settings → Product defaults.">
                  <TextAreaField id="shipping_returns_md" label="Shipping & returns note for this product" rows={4} value={p.shipping_returns_md ?? ""} onChange={(v) => set("shipping_returns_md", v)} max={4000} />
          </Card>

          <Card
            id="section-tax"
            title="Tax"
            description={gstRegistered ? "Used to calculate GST on orders and invoices." : "GST is switched off in Settings → Tax. You can still store these for later."}
           
          >
                  <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="hsn_code" label="HSN code" value={p.hsn_code ?? ""} onChange={(v) => set("hsn_code", v.replace(/\D/g, ""))} error={err("hsn_code")} max={8} hint="From your GST registration or tax advisor." />
              <div data-field="gst_rate">
                <Label htmlFor="gst_rate">GST rate</Label>
                <Select id="gst_rate" value={p.gst_rate ?? ""} onChange={(e) => set("gst_rate", e.target.value)}>
                  {GST_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r === "" ? "Not set" : `${r}%`}
                    </option>
                  ))}
                </Select>
                <FieldError message={err("gst_rate")} />
                <p className="mt-1.5 text-[0.78rem] text-muted">Confirm the correct rate with your tax advisor — the website never guesses it.</p>
              </div>
            </div>
          </Card>

          <SeoCard p={p} set={set} siteHost={siteHost} />
        </fieldset>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Card title="Visibility">
          <fieldset disabled={!canWrite} className="grid gap-3">
            <legend className="sr-only">Product status</legend>
            {(
              [
                ["published", "Live", "Visible in the shop and can be bought."],
                ["draft", "Draft", "Hidden from customers. Use Preview to check it."],
                ["archived", "Archived", "Hidden and kept for records."],
              ] as const
            ).map(([value, label, desc]) => (
              <label key={value} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3", p.status === value ? "border-forest bg-sage-soft/50" : "border-line")}>
                <input type="radio" name="status" value={value} checked={p.status === value} onChange={() => set("status", value)} className="mt-1 accent-[var(--color-forest)]" />
                <span>
                  <span className="block text-[0.88rem] font-semibold">{label}</span>
                  <span className="block text-[0.76rem] text-muted">{desc}</span>
                </span>
              </label>
            ))}
            <a href={previewHref} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-forest hover:underline">
              <ExternalLink className="size-3.5" aria-hidden="true" /> {p.status === "published" ? "View on website" : "Preview (last saved version)"}
            </a>
          </fieldset>
        </Card>

        <Card title="Collections">
          <fieldset disabled={!canWrite} className="grid gap-2">
            <legend className="sr-only">Collections</legend>
            {categories.length === 0 ? <p className="text-[0.82rem] text-muted">No collections yet.</p> : null}
            {categories.map((c) => (
              <Checkbox
                key={c.id}
                checked={p.category_ids.includes(c.id)}
                onChange={(e) => set("category_ids", e.target.checked ? [...p.category_ids, c.id] : p.category_ids.filter((id) => id !== c.id))}
                label={c.is_active ? c.name : `${c.name} (hidden)`}
              />
            ))}
          </fieldset>
        </Card>

        <Card title="Display">
          <fieldset disabled={!canWrite} className="grid gap-4">
            <legend className="sr-only">Display options</legend>
            <Checkbox checked={p.is_featured} onChange={(e) => set("is_featured", e.target.checked)} label="Featured product" description="Shown first where featured products appear." />
            <div>
              <Label htmlFor="sort_order">Sort order</Label>
              <Input id="sort_order" type="number" min={0} max={9999} value={String(p.sort_order ?? 0)} onChange={(e) => set("sort_order", Number(e.target.value) || 0)} className="h-10 w-28" />
              <p className="mt-1 text-[0.75rem] text-muted">Lower numbers appear first in the shop.</p>
            </div>
          </fieldset>
        </Card>
      </aside>

      {canWrite ? (
        <StickySaveBar dirty={dirty}>
          {initial.status !== "published" && p.status !== "published" ? (
            <Button type="button" variant="secondary" size="sm" loading={pending} onClick={() => save("published")}>
              Save &amp; publish
            </Button>
          ) : null}
          <Button type="button" size="sm" loading={pending} onClick={() => save()} disabled={!dirty && !pending}>
            Save
          </Button>
        </StickySaveBar>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small field helpers
// ---------------------------------------------------------------------------
function TextField({ id, label, value, onChange, error, hint, max, required }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; hint?: ReactNode; max?: number; required?: boolean }) {
  return (
    <div data-field={id}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-danger" aria-hidden="true">*</span> : null}
      </Label>
      <Input id={id} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error || undefined} aria-describedby={hint ? `${id}-hint` : undefined} className="h-11" />
      {hint && !error ? <p id={`${id}-hint`} className="mt-1 text-[0.75rem] text-muted">{hint}</p> : null}
      <FieldError message={error} />
    </div>
  );
}

function TextAreaField({ id, label, value, onChange, hint, max, rows = 3 }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; max?: number; rows?: number }) {
  return (
    <div data-field={id}>
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={rows} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint ? <p id={`${id}-hint`} className="mt-1 text-[0.75rem] text-muted">{hint}</p> : null}
    </div>
  );
}

function IconButton({ label, onClick, disabled, children, danger }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("grid size-8 place-items-center rounded-full disabled:opacity-30", danger ? "text-danger hover:bg-danger-soft" : "hover:bg-forest/[0.06]")}
    >
      {children}
    </button>
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------
function ImagesCard({ images, onChange, productName, error }: { images: EditorProduct["images"]; onChange: (v: EditorProduct["images"]) => void; productName: string; error?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useImageUpload("products");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const missingAlt = images.filter((i) => !i.alt.trim()).length;

  return (
    <Card
      id="section-images"
      title="Images"
      description="The first image is the main product image. Drag to reorder, or use the arrows. Label artwork can be added so customers can read the pack."
     
      actions={
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            aria-label="Upload product images"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              const added: EditorProduct["images"] = [];
              for (const file of files) {
                const r = await upload(file, productName);
                if (r) added.push({ url: r.url, alt: productName, kind: "packshot", width: r.width, height: r.height });
              }
              if (added.length) onChange([...images, ...added]);
            }}
          />
          <Button type="button" size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" aria-hidden="true" /> Upload
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
            <ImagePlus className="size-3.5" aria-hidden="true" /> Media library
          </Button>
        </div>
      }
    >
      {missingAlt > 0 ? (
        <div className="mb-4">
          <Notice tone="warning">Describe every image (alt text) — it helps blind customers and search engines, and is required before publishing.</Notice>
        </div>
      ) : null}
      <FieldError message={error} />
      {images.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-[0.88rem] text-muted">No images yet. Upload product images or pick them from the media library.</p>
      ) : (
        <ol className="grid gap-3">
          {images.map((img, i) => (
            <li
              key={img.id ?? `${img.url}-${i}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== i) onChange(move(images, dragIndex, i));
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn("flex flex-wrap items-start gap-3 rounded-xl border bg-cream/40 p-3 sm:flex-nowrap", dragIndex === i ? "border-forest opacity-60" : "border-line")}
            >
              <GripVertical className="mt-8 hidden size-4 shrink-0 cursor-grab text-muted sm:block" aria-hidden="true" />
              <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-cream-deep ring-1 ring-line">
                <Image src={img.url} alt="" fill sizes="96px" className="object-contain" />
                {i === 0 ? <span className="absolute left-1 top-1 rounded-full bg-forest px-2 py-0.5 text-[0.62rem] font-semibold text-cream">Main</span> : null}
              </div>
              <div className="grid min-w-0 flex-1 gap-2">
                <div>
                  <Label htmlFor={`img-alt-${i}`} className="text-[0.75rem]">
                    Image description (alt text)
                  </Label>
                  <Input
                    id={`img-alt-${i}`}
                    value={img.alt}
                    maxLength={240}
                    onChange={(e) => onChange(images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
                    className="h-10"
                    aria-invalid={!img.alt.trim() || undefined}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label htmlFor={`img-kind-${i}`} className="text-[0.75rem]">
                      Type
                    </Label>
                    <Select id={`img-kind-${i}`} value={img.kind} onChange={(e) => onChange(images.map((x, j) => (j === i ? { ...x, kind: e.target.value as ImageKind } : x)))} className="h-10 w-56 py-0 text-[0.85rem]">
                      {IMAGE_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <span className="truncate pb-2 text-[0.72rem] text-muted">{img.width && img.height ? `${img.width}×${img.height}px` : ""}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-0.5 sm:flex-col">
                <IconButton label={`Move image ${i + 1} up`} disabled={i === 0} onClick={() => onChange(move(images, i, i - 1))}>
                  <ArrowUp className="size-4" aria-hidden="true" />
                </IconButton>
                <IconButton label={`Move image ${i + 1} down`} disabled={i === images.length - 1} onClick={() => onChange(move(images, i, i + 1))}>
                  <ArrowDown className="size-4" aria-hidden="true" />
                </IconButton>
                <IconButton label={`Remove image ${i + 1}`} danger onClick={() => onChange(images.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
      )}
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(m) => onChange([...images, { url: m.url, alt: m.alt || productName, kind: "packshot", width: m.width, height: m.height }])}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Variants & pricing
// ---------------------------------------------------------------------------
function VariantsCard({ variants, onChange, errors }: { variants: EditorProduct["variants"]; onChange: (v: EditorProduct["variants"]) => void; errors: Record<string, string> }) {
  const update = (i: number, patch: Partial<EditorProduct["variants"][number]>) => onChange(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <Card
      id="section-pricing"
      title="Sizes & prices"
      description="Prices are in rupees and include GST if you are registered. The selling price can be lower than MRP — a saving is shown only when you set one."
     
    >
      <ol className="grid gap-4">
        {variants.map((v, i) => {
          const mrp = rupeesToPaise(v.mrp);
          const price = rupeesToPaise(v.price);
          const e = (k: string) => errors[`variants.${i}.${k}`];
          return (
            <li key={v.id ?? i} className="rounded-xl border border-line bg-cream/40 p-4" data-field={`variants.${i}.title`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[0.8rem] font-semibold text-muted">
                  Size {i + 1}
                  {v.id ? (
                    <span className="ml-2 font-normal">
                      · Stock: <strong className="text-graphite">{v.stock}</strong>
                      {v.is_demo_stock ? " (demo)" : ""} — change in Inventory
                    </span>
                  ) : (
                    <span className="ml-2 font-normal">· New — starts with 0 stock</span>
                  )}
                </span>
                <span className="flex gap-0.5">
                  <IconButton label={`Move size ${i + 1} up`} disabled={i === 0} onClick={() => onChange(move(variants, i, i - 1))}>
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton label={`Move size ${i + 1} down`} disabled={i === variants.length - 1} onClick={() => onChange(move(variants, i, i + 1))}>
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Remove size ${i + 1}`}
                    danger
                    disabled={variants.length === 1}
                    onClick={() => {
                      if (window.confirm("Remove this size? If it has been ordered before, untick “Available” instead.")) onChange(variants.filter((_, j) => j !== i));
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </IconButton>
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <TextField id={`v-title-${i}`} label="Size name" value={v.title} onChange={(x) => update(i, { title: x })} error={e("title")} max={80} />
                <TextField id={`v-sku-${i}`} label="SKU" value={v.sku} onChange={(x) => update(i, { sku: x.toUpperCase() })} error={e("sku")} max={64} />
                <TextField id={`v-mrp-${i}`} label="MRP (₹)" value={v.mrp} onChange={(x) => update(i, { mrp: x.replace(/[^\d.]/g, "") })} error={e("mrp")} />
                <TextField id={`v-price-${i}`} label="Selling price (₹)" value={v.price} onChange={(x) => update(i, { price: x.replace(/[^\d.]/g, "") })} error={e("price")} />
                <TextField id={`v-barcode-${i}`} label="Barcode (EAN)" value={v.barcode} onChange={(x) => update(i, { barcode: x })} max={64} />
                <div>
                  <Label htmlFor={`v-weight-${i}`}>Shipping weight (g)</Label>
                  <Input id={`v-weight-${i}`} type="number" min={0} value={String(v.weight_grams)} onChange={(x) => update(i, { weight_grams: Number(x.target.value) || 0 })} className="h-11" />
                </div>
                <div>
                  <Label htmlFor={`v-low-${i}`}>Low-stock alert at</Label>
                  <Input id={`v-low-${i}`} type="number" min={0} value={String(v.low_stock_threshold)} onChange={(x) => update(i, { low_stock_threshold: Number(x.target.value) || 0 })} className="h-11" />
                </div>
                <div className="flex items-end pb-3">
                  <Checkbox checked={v.is_active} onChange={(x) => update(i, { is_active: x.target.checked })} label="Available to buy" />
                </div>
              </div>
              <p className="mt-2 text-[0.78rem] text-muted">
                {mrp === null || price === null ? (
                  <span className="text-danger">Enter prices as numbers, e.g. 149 or 149.50.</span>
                ) : price > mrp ? (
                  <span className="text-danger">Selling price is higher than MRP.</span>
                ) : price === 0 ? (
                  "Price not set — the product can’t be published until it has one."
                ) : price < mrp ? (
                  `Customers see ${formatINR(price)} with MRP ${formatINR(mrp)} crossed out (${discountPercent(mrp, price)}% off).`
                ) : (
                  `Customers see ${formatINR(price)}.`
                )}
              </p>
            </li>
          );
        })}
      </ol>
      {variants.length < 20 ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-4"
          onClick={() =>
            onChange([
              ...variants,
              { title: "", sku: "", barcode: "", weight_grams: 0, mrp: "", price: "", low_stock_threshold: 5, is_active: true, stock: 0, is_demo_stock: false },
            ])
          }
        >
          <Plus className="size-3.5" aria-hidden="true" /> Add a size
        </Button>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Nutrition, claims, SEO
// ---------------------------------------------------------------------------
function NutritionTable({ rows, onChange }: { rows: EditorProduct["nutrition"]; onChange: (v: EditorProduct["nutrition"]) => void }) {
  return (
    <fieldset className="rounded-xl border border-line p-4">
      <legend className="px-1 text-[0.82rem] font-semibold">Nutrition facts (per 100 g)</legend>
      {rows.length === 0 ? <p className="text-[0.82rem] text-muted">No nutrition rows. The table is hidden on the website until you add some.</p> : null}
      <ol className="grid gap-2">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <Input aria-label={`Nutrient ${i + 1}`} placeholder="Nutrient, e.g. Energy" value={r.nutrient} maxLength={60} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, nutrient: e.target.value } : x)))} className="h-10 min-w-40 flex-1" />
            <Input aria-label={`Amount for nutrient ${i + 1}`} placeholder="e.g. 352 kcal" value={r.per_100g} maxLength={40} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, per_100g: e.target.value } : x)))} className="h-10 w-36" />
            <IconButton label={`Move row ${i + 1} up`} disabled={i === 0} onClick={() => onChange(move(rows, i, i - 1))}>
              <ArrowUp className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton label={`Remove row ${i + 1}`} danger onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 className="size-4" aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ol>
      <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => onChange([...rows, { nutrient: "", per_100g: "" }])}>
        <Plus className="size-3.5" aria-hidden="true" /> Add row
      </Button>
    </fieldset>
  );
}

function LabelList({ title, items, onChange, placeholder }: { title: string; items: LabelItem[]; onChange: (v: LabelItem[]) => void; placeholder: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[0.82rem] font-semibold">{title}</legend>
      <ol className="grid gap-2">
        {items.map((c, i) => (
          <li key={i} className={cn("rounded-xl border p-3", c.approved ? "border-success/30 bg-success-soft/40" : "border-banana/50 bg-banana-soft/30")}>
            <div className="flex items-center gap-2">
              <Input aria-label={`${title} ${i + 1}`} value={c.label} placeholder={placeholder} maxLength={80} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="h-10 flex-1" />
              <IconButton label={`Remove ${title.toLowerCase()} ${i + 1}`} danger onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
            <Checkbox
              className="mt-2"
              checked={c.approved}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, approved: e.target.checked } : x)))}
              label={c.approved ? "Approved — shown on the website" : "Not approved — hidden"}
            />
          </li>
        ))}
      </ol>
      {items.length < 20 ? (
        <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => onChange([...items, { label: "", approved: false }])}>
          <Plus className="size-3.5" aria-hidden="true" /> Add
        </Button>
      ) : null}
    </fieldset>
  );
}

function SeoCard({ p, set, siteHost }: { p: EditorProduct; siteHost: string; set: <K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) => void }) {
  const title = (p.seo_title || p.title || "").trim();
  const description = (p.seo_description || p.short_description || "").trim();
  return (
    <Card id="section-seo" title="Search engines (SEO)" description="How this product can appear in Google. Leave empty to use the product name and short description.">
      <div className="mb-5 rounded-xl border border-line bg-white p-4" aria-label="Search result preview">
        <p className="truncate text-[0.78rem] text-muted">
          {siteHost}/products/{p.slug}
        </p>
        <p className="mt-0.5 truncate text-[1.05rem] text-[#1a0dab]">{title || "Product name"}</p>
        <p className="mt-0.5 line-clamp-2 text-[0.82rem] text-graphite">{description || "Add a short description so search engines can show a summary."}</p>
      </div>
      <div className="grid gap-4">
        <TextField id="seo_title" label={`Page title (${(p.seo_title ?? "").length}/60 recommended)`} value={p.seo_title ?? ""} onChange={(v) => set("seo_title", v)} max={120} />
        <TextAreaField id="seo_description" label={`Meta description (${(p.seo_description ?? "").length}/160 recommended)`} rows={3} value={p.seo_description ?? ""} onChange={(v) => set("seo_description", v)} max={300} />
        <TextField id="og_image_url" label="Social sharing image (optional)" value={p.og_image_url ?? ""} onChange={(v) => set("og_image_url", v)} max={500} hint="Leave empty to use the main product image." />
      </div>
    </Card>
  );
}
