"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { createQuickProductAction } from "@/app/admin/_actions/products";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldError, Input, Label, Textarea } from "@/components/ui/field";
import { formatINR, rupeesToPaise, discountPercent } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card } from "./ui";
import { useAdminAction } from "./forms";
import { MediaPicker, useImageUpload } from "./image-field";

type Img = { url: string; width: number | null; height: number | null };

/**
 * Simple one-page "Add product": name, photos, price, size and opening stock.
 * Everything else (label, nutrition, SEO…) can be filled in afterwards on the product page.
 */
export function NewProductForm({ categories, canSetStock }: { categories: { id: string; name: string }[]; canSetStock: boolean }) {
  const router = useRouter();
  const { run, pending } = useAdminAction();
  const { upload, uploading } = useImageUpload("products");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState({
    title: "",
    short_description: "",
    size: "100 g",
    price: "",
    mrp: "",
    weight_grams: "120",
    stock: "0",
    sku: "",
    category_ids: [] as string[],
    images: [] as Img[],
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const addFiles = async (files: File[]) => {
    const added: Img[] = [];
    for (const file of files.filter((x) => x.type.startsWith("image/"))) {
      const r = await upload(file, f.title);
      if (r) added.push({ url: r.url, width: r.width, height: r.height });
    }
    if (added.length) setF((prev) => ({ ...prev, images: [...prev.images, ...added] }));
  };

  const save = async (publish: boolean) => {
    const r = await run(
      () =>
        createQuickProductAction({
          ...f,
          weight_grams: Number(f.weight_grams) || 0,
          stock: canSetStock ? Number(f.stock) || 0 : 0,
          publish,
        }),
      { refresh: false },
    );
    setErrors((r.errors as Record<string, string> | undefined) ?? {});
    if (r.ok && typeof r.data === "string") router.push(`/admin/products/${r.data}`);
  };

  const price = rupeesToPaise(f.price);
  const mrp = f.mrp ? rupeesToPaise(f.mrp) : price;
  const err = (k: string) => errors[k];

  return (
    <div className="grid gap-6 pb-10 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="np-title">Title</Label>
              <Input id="np-title" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={160} placeholder="e.g. UNAR Banana Chewy — Fresh Raw Banana" className="h-11" aria-invalid={!!err("title") || undefined} />
              <FieldError message={err("title")} />
            </div>
            <div>
              <Label htmlFor="np-desc">Short description</Label>
              <Textarea id="np-desc" rows={3} value={f.short_description} onChange={(e) => set("short_description", e.target.value)} maxLength={400} placeholder="One or two sentences for product cards and search results." />
            </div>
          </div>
        </Card>

        <Card title="Photos" description="The first photo is the main image. Use the real product photos.">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            aria-label="Upload product photos"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              await addFiles(files);
            }}
          />
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragOver(false);
              await addFiles(Array.from(e.dataTransfer.files));
            }}
            className={cn("rounded-2xl border-2 border-dashed p-4 transition-colors", dragOver ? "border-forest bg-sage-soft/40" : "border-line")}
          >
            {f.images.length ? (
              <ol className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {f.images.map((img, i) => (
                  <li key={img.url + i} className={cn("group relative aspect-square overflow-hidden rounded-xl bg-cream-deep ring-1 ring-line", i === 0 && "col-span-2 row-span-2")}>
                    <Image src={img.url} alt="" fill sizes="200px" className="object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => set("images", f.images.filter((_, j) => j !== i))}
                      className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-paper/90 text-danger shadow"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-2 py-3 text-center">
              <Button type="button" size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
                <Upload className="size-3.5" aria-hidden="true" /> Add photos
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
                <ImagePlus className="size-3.5" aria-hidden="true" /> Media library
              </Button>
              <span className="w-full text-[0.78rem] text-muted">or drag photos here</span>
            </div>
          </div>
          <FieldError message={err("images")} />
          <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(m) => set("images", [...f.images, { url: m.url, width: m.width, height: m.height }])} />
        </Card>

        <Card title="Pricing" description="In rupees, including GST if you are registered.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="np-price">Price (₹)</Label>
              <Input id="np-price" inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value.replace(/[^\d.]/g, ""))} placeholder="149" className="h-11" aria-invalid={!!err("price") || undefined} />
              <FieldError message={err("price")} />
            </div>
            <div>
              <Label htmlFor="np-mrp">MRP (₹, optional)</Label>
              <Input id="np-mrp" inputMode="decimal" value={f.mrp} onChange={(e) => set("mrp", e.target.value.replace(/[^\d.]/g, ""))} placeholder="Same as price" className="h-11" aria-invalid={!!err("mrp") || undefined} />
              <FieldError message={err("mrp")} />
            </div>
          </div>
          <p className="mt-2 text-[0.8rem] text-muted">
            {price && mrp && mrp > price
              ? `Customers see ${formatINR(price)} with MRP ${formatINR(mrp)} crossed out (${discountPercent(mrp, price)}% off).`
              : price
                ? `Customers see ${formatINR(price)}.`
                : "Enter the selling price."}
          </p>
        </Card>

        <Card title="Size, stock and shipping">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="np-size">Size / pack</Label>
              <Input id="np-size" value={f.size} onChange={(e) => set("size", e.target.value)} maxLength={80} className="h-11" aria-invalid={!!err("size") || undefined} />
              <FieldError message={err("size")} />
            </div>
            {canSetStock ? (
              <div>
                <Label htmlFor="np-stock">Quantity in stock</Label>
                <Input id="np-stock" type="number" min={0} value={f.stock} onChange={(e) => set("stock", e.target.value)} className="h-11" aria-invalid={!!err("stock") || undefined} />
                <FieldError message={err("stock")} />
              </div>
            ) : null}
            <div>
              <Label htmlFor="np-weight">Shipping weight with pack (g)</Label>
              <Input id="np-weight" type="number" min={0} value={f.weight_grams} onChange={(e) => set("weight_grams", e.target.value)} className="h-11" />
            </div>
            <div>
              <Label htmlFor="np-sku">SKU (optional)</Label>
              <Input id="np-sku" value={f.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} maxLength={64} placeholder="Made for you if empty" className="h-11 font-mono" aria-invalid={!!err("sku") || undefined} />
              <FieldError message={err("sku")} />
            </div>
          </div>
          <p className="mt-3 text-[0.8rem] text-muted">More sizes, label details, nutrition and search-engine text can be added on the product page after saving.</p>
        </Card>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Card title="Collections">
          {categories.length === 0 ? <p className="text-[0.82rem] text-muted">No collections yet.</p> : null}
          <div className="grid gap-2">
            {categories.map((c) => (
              <Checkbox
                key={c.id}
                checked={f.category_ids.includes(c.id)}
                onChange={(e) => set("category_ids", e.target.checked ? [...f.category_ids, c.id] : f.category_ids.filter((x) => x !== c.id))}
                label={c.name}
              />
            ))}
          </div>
        </Card>
        <Card>
          <div className="grid gap-2">
            <Button type="button" loading={pending} onClick={() => save(true)}>
              Save &amp; publish
            </Button>
            <Button type="button" variant="secondary" loading={pending} onClick={() => save(false)}>
              Save as draft
            </Button>
            <p className="text-[0.76rem] text-muted">Drafts stay hidden from customers until you publish them.</p>
          </div>
        </Card>
      </aside>
    </div>
  );
}
