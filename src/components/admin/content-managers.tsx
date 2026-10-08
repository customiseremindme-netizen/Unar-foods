"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { Copy, Plus, Upload } from "lucide-react";
import {
  deleteBannerAction,
  deleteFaqAction,
  deleteInstagramAction,
  saveBannerAction,
  saveFaqAction,
  saveInstagramAction,
} from "@/app/admin/_actions/content";
import { deleteMediaAction, updateMediaAltAction } from "@/app/admin/_actions/media";
import type { BundledImage } from "@/lib/admin/bundled-media";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { ActionButton, AdminForm, useAdminAction, useFieldError } from "./forms";
import { ImageField, useImageUpload } from "./image-field";
import { Card } from "./ui";

function Err({ name }: { name: string }) {
  const message = useFieldError(name);
  return message ? <p className="mt-1 text-[0.78rem] font-medium text-danger">{message}</p> : null;
}

function FormButtons({ onCancel, onDelete, deleteConfirm, saveLabel = "Save" }: { onCancel?: () => void; onDelete?: () => Promise<{ ok: boolean; message: string | null }>; deleteConfirm?: string; saveLabel?: string }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button type="submit" size="sm">
        {saveLabel}
      </Button>
      {onCancel ? (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
      {onDelete ? (
        <ActionButton variant="ghost" size="sm" className="text-danger" action={onDelete} confirm={deleteConfirm}>
          Delete
        </ActionButton>
      ) : null}
    </div>
  );
}

function AddToggle({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" aria-hidden="true" /> {label}
      </Button>
    );
  }
  return <Card title={label}>{children(() => setOpen(false))}</Card>;
}

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------
type Faq = { id: string; question: string; answer_md: string; category: string; sort_order: number; is_published: boolean; show_on_home: boolean };

function FaqFields({ f }: { f?: Faq }) {
  const p = f?.id ?? "new";
  return (
    <div className="grid gap-4">
      <input type="hidden" name="id" value={f?.id ?? ""} />
      <div>
        <Label htmlFor={`${p}-q`}>Question</Label>
        <Input id={`${p}-q`} name="question" defaultValue={f?.question} maxLength={300} className="h-11" />
        <Err name="question" />
      </div>
      <div>
        <Label htmlFor={`${p}-a`}>Answer</Label>
        <Textarea id={`${p}-a`} name="answer_md" rows={4} defaultValue={f?.answer_md} maxLength={4000} />
        <Err name="answer_md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor={`${p}-c`}>Group</Label>
          <Input id={`${p}-c`} name="category" defaultValue={f?.category ?? "General"} maxLength={60} className="h-11" />
        </div>
        <div>
          <Label htmlFor={`${p}-s`}>Order</Label>
          <Input id={`${p}-s`} name="sort_order" type="number" min={0} defaultValue={f?.sort_order ?? 100} className="h-11" />
        </div>
        <div className="grid content-end gap-2 pb-1">
          <Checkbox name="is_published" defaultChecked={f?.is_published ?? true} label="Published" />
          <Checkbox name="show_on_home" defaultChecked={f?.show_on_home ?? false} label="Show on homepage" />
        </div>
      </div>
    </div>
  );
}

export function FaqManager({ faqs }: { faqs: Faq[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {faqs.map((f) =>
        editing === f.id ? (
          <Card key={f.id} title="Edit question">
            <AdminForm action={saveFaqAction} onSuccess={() => setEditing(null)}>
              <FaqFields f={f} />
              <FormButtons onCancel={() => setEditing(null)} onDelete={() => deleteFaqAction(f.id)} deleteConfirm="Delete this question?" />
            </AdminForm>
          </Card>
        ) : (
          <div key={f.id} className="flex flex-wrap items-start gap-3 rounded-[1.25rem] border border-line bg-paper px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-forest">{f.question}</p>
              <p className="mt-1 line-clamp-2 text-[0.84rem] text-muted">{f.answer_md}</p>
              <p className="mt-2 flex flex-wrap gap-1">
                <Badge tone="muted">{f.category}</Badge>
                {!f.is_published ? <Badge tone="neutral">Hidden</Badge> : null}
                {f.show_on_home ? <Badge tone="sage">Homepage</Badge> : null}
              </p>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(f.id)}>
              Edit
            </Button>
          </div>
        ),
      )}
      <AddToggle label="Add a question">
        {(close) => (
          <AdminForm action={saveFaqAction} onSuccess={close}>
            <FaqFields />
            <FormButtons onCancel={close} saveLabel="Add question" />
          </AdminForm>
        )}
      </AddToggle>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------
type Banner = {
  id: string;
  placement: string;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  image_alt: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
};

const PLACEMENTS: Record<string, string> = {
  announcement: "Announcement bar (top of every page)",
  home_promo: "Homepage promotion (below the hero)",
  shop_top: "Top of the shop page",
};

/** ISO → value for <input type="datetime-local"> in India time. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

function BannerFields({ b }: { b?: Banner }) {
  const p = b?.id ?? "new";
  const [image, setImage] = useState(b?.image_url ?? "");
  const [placement, setPlacement] = useState(b?.placement ?? "announcement");
  return (
    <div className="grid gap-4">
      <input type="hidden" name="id" value={b?.id ?? ""} />
      <div>
        <Label htmlFor={`${p}-pl`}>Where</Label>
        <Select id={`${p}-pl`} name="placement" value={placement} onChange={(e) => setPlacement(e.target.value)}>
          {Object.entries(PLACEMENTS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${p}-t`}>{placement === "announcement" ? "Message" : "Heading"}</Label>
        <Input id={`${p}-t`} name="title" defaultValue={b?.title} maxLength={160} className="h-11" />
        <Err name="title" />
      </div>
      {placement !== "announcement" ? (
        <div>
          <Label htmlFor={`${p}-b`}>Text (optional)</Label>
          <Textarea id={`${p}-b`} name="body" rows={2} defaultValue={b?.body ?? ""} maxLength={400} />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${p}-cl`}>Link text (optional)</Label>
          <Input id={`${p}-cl`} name="cta_label" defaultValue={b?.cta_label ?? ""} maxLength={40} className="h-11" />
        </div>
        <div>
          <Label htmlFor={`${p}-cu`}>Link address</Label>
          <Input id={`${p}-cu`} name="cta_url" defaultValue={b?.cta_url ?? ""} placeholder="/shop" className="h-11" />
          <Err name="cta_url" />
        </div>
      </div>
      {placement !== "announcement" ? (
        <>
          <input type="hidden" name="image_url" value={image} />
          <ImageField id={`${p}-img`} label="Image (optional)" value={image} onChange={setImage} folder="banners" />
          <div>
            <Label htmlFor={`${p}-ia`}>Image description</Label>
            <Input id={`${p}-ia`} name="image_alt" defaultValue={b?.image_alt ?? ""} maxLength={200} className="h-11" />
            <Err name="image_alt" />
          </div>
        </>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor={`${p}-st`}>Start (optional)</Label>
          <Input id={`${p}-st`} name="starts_at" type="datetime-local" defaultValue={toLocalInput(b?.starts_at ?? null)} className="h-11" />
        </div>
        <div>
          <Label htmlFor={`${p}-en`}>End (optional)</Label>
          <Input id={`${p}-en`} name="ends_at" type="datetime-local" defaultValue={toLocalInput(b?.ends_at ?? null)} className="h-11" />
          <Err name="ends_at" />
        </div>
        <div>
          <Label htmlFor={`${p}-so`}>Order</Label>
          <Input id={`${p}-so`} name="sort_order" type="number" min={0} defaultValue={b?.sort_order ?? 0} className="h-11" />
        </div>
      </div>
      <Checkbox name="is_active" defaultChecked={b?.is_active ?? false} label="Switched on" description="Shown only while switched on and within the dates above." />
    </div>
  );
}

export function BannerManager({ banners }: { banners: Banner[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const now = new Date().toISOString();
  return (
    <div className="space-y-3">
      {banners.map((b) => {
        const live = b.is_active && (!b.starts_at || b.starts_at <= now) && (!b.ends_at || b.ends_at > now);
        return editing === b.id ? (
          <Card key={b.id} title="Edit banner">
            <AdminForm action={saveBannerAction} onSuccess={() => setEditing(null)}>
              <BannerFields b={b} />
              <FormButtons onCancel={() => setEditing(null)} onDelete={() => deleteBannerAction(b.id)} deleteConfirm="Delete this banner?" />
            </AdminForm>
          </Card>
        ) : (
          <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-line bg-paper px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-forest">{b.title}</p>
              <p className="mt-1 text-[0.8rem] text-muted">
                {PLACEMENTS[b.placement]}
                {b.starts_at || b.ends_at ? ` · ${b.starts_at ? formatDate(b.starts_at) : "now"} → ${b.ends_at ? formatDate(b.ends_at) : "no end"}` : ""}
              </p>
            </div>
            {live ? <Badge tone="success">Showing now</Badge> : b.is_active ? <Badge tone="banana">Scheduled / ended</Badge> : <Badge tone="muted">Off</Badge>}
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(b.id)}>
              Edit
            </Button>
          </div>
        );
      })}
      <AddToggle label="Add a banner">
        {(close) => (
          <AdminForm action={saveBannerAction} onSuccess={close}>
            <BannerFields />
            <FormButtons onCancel={close} saveLabel="Add banner" />
          </AdminForm>
        )}
      </AddToggle>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instagram
// ---------------------------------------------------------------------------
type InstagramPost = { id: string; image_url: string; image_alt: string; permalink: string; caption: string | null; is_published: boolean; sort_order: number };

function InstagramFields({ post }: { post?: InstagramPost }) {
  const p = post?.id ?? "new";
  const [image, setImage] = useState(post?.image_url ?? "");
  return (
    <div className="grid gap-4">
      <input type="hidden" name="id" value={post?.id ?? ""} />
      <input type="hidden" name="image_url" value={image} />
      <ImageField id={`${p}-img`} label="Image" value={image} onChange={setImage} folder="instagram" />
      <Err name="image_url" />
      <div>
        <Label htmlFor={`${p}-alt`}>Image description</Label>
        <Input id={`${p}-alt`} name="image_alt" defaultValue={post?.image_alt} maxLength={200} className="h-11" />
        <Err name="image_alt" />
      </div>
      <div>
        <Label htmlFor={`${p}-link`}>Link to the Instagram post</Label>
        <Input id={`${p}-link`} name="permalink" defaultValue={post?.permalink} placeholder="https://www.instagram.com/p/…" className="h-11" />
        <Err name="permalink" />
      </div>
      <div>
        <Label htmlFor={`${p}-cap`}>Caption (optional)</Label>
        <Input id={`${p}-cap`} name="caption" defaultValue={post?.caption ?? ""} maxLength={300} className="h-11" />
      </div>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <Label htmlFor={`${p}-so`}>Order</Label>
          <Input id={`${p}-so`} name="sort_order" type="number" min={0} defaultValue={post?.sort_order ?? 0} className="h-11 w-28" />
        </div>
        <Checkbox name="is_published" defaultChecked={post?.is_published ?? true} label="Show on the website" className="pb-3" />
      </div>
    </div>
  );
}

export function InstagramManager({ posts }: { posts: InstagramPost[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {posts.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) =>
            editing === post.id ? (
              <li key={post.id} className="sm:col-span-2 lg:col-span-3">
                <Card title="Edit post">
                  <AdminForm action={saveInstagramAction} onSuccess={() => setEditing(null)}>
                    <InstagramFields post={post} />
                    <FormButtons onCancel={() => setEditing(null)} onDelete={() => deleteInstagramAction(post.id)} deleteConfirm="Remove this post from the website?" />
                  </AdminForm>
                </Card>
              </li>
            ) : (
              <li key={post.id} className="overflow-hidden rounded-[1.25rem] border border-line bg-paper">
                <div className="relative aspect-square bg-cream-deep">
                  <Image src={post.image_url} alt={post.image_alt} fill sizes="300px" className="object-cover" />
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  {post.is_published ? <Badge tone="success">Shown</Badge> : <Badge tone="muted">Hidden</Badge>}
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(post.id)}>
                    Edit
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="text-[0.88rem] text-muted">No Instagram posts added yet.</p>
      )}
      <AddToggle label="Add an Instagram post">
        {(close) => (
          <AdminForm action={saveInstagramAction} onSuccess={close}>
            <InstagramFields />
            <FormButtons onCancel={close} saveLabel="Add post" />
          </AdminForm>
        )}
      </AddToggle>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Media library
// ---------------------------------------------------------------------------
type Media = { id: string; url: string; alt: string; width: number | null; height: number | null; size_bytes: number; mime_type: string; created_at: string };

function CopyButton({ text }: { text: string }) {
  const { notify } = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          notify("Image address copied.", "success");
        } catch {
          notify("Could not copy — select the address and copy it manually.", "error");
        }
      }}
      className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-forest hover:underline"
    >
      <Copy className="size-3" aria-hidden="true" /> Copy address
    </button>
  );
}

function MediaItem({ m }: { m: Media }) {
  const [alt, setAlt] = useState(m.alt);
  const { run, pending } = useAdminAction();
  return (
    <li className="overflow-hidden rounded-[1.25rem] border border-line bg-paper">
      <div className="relative aspect-square bg-cream-deep">
        <Image src={m.url} alt={m.alt} fill sizes="240px" className="object-contain" unoptimized={m.mime_type === "image/svg+xml"} />
      </div>
      <div className="grid gap-2 p-3">
        <p className="text-[0.72rem] text-muted">
          {m.width && m.height ? `${m.width}×${m.height}px · ` : ""}
          {Math.round(m.size_bytes / 1024)} KB · {formatDate(m.created_at)}
        </p>
        <label className="text-[0.72rem] font-semibold" htmlFor={`alt-${m.id}`}>
          Description
        </label>
        <input id={`alt-${m.id}`} value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} className="h-9 rounded-lg border border-line bg-cream/40 px-2 text-[0.8rem]" />
        <div className="flex flex-wrap items-center gap-3">
          {alt !== m.alt ? (
            <Button type="button" size="sm" loading={pending} onClick={() => run(() => updateMediaAltAction(m.id, alt))}>
              Save
            </Button>
          ) : null}
          <CopyButton text={m.url} />
          <ActionButton variant="link" size="sm" className="text-[0.75rem] text-danger" action={() => deleteMediaAction(m.id)} confirm="Delete this image? Anything still using it will show a missing image.">
            Delete
          </ActionButton>
        </div>
      </div>
    </li>
  );
}

export function MediaLibrary({ items, bundled }: { items: Media[]; bundled: BundledImage[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useImageUpload("library");
  const { run } = useAdminAction();
  return (
    <div className="space-y-8">
      <div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          aria-label="Upload images"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            for (const f of files) await upload(f, f.name.replace(/\.\w+$/, "").replace(/[-_]+/g, " "));
            await run(async () => ({ ok: true, message: null }));
          }}
        />
        <Button type="button" loading={uploading} onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" aria-hidden="true" /> Upload images
        </Button>
        <p className="mt-2 text-[0.78rem] text-muted">JPG, PNG, WebP or AVIF, up to 4 MB each. Very large photos are shrunk automatically.</p>
      </div>
      {items.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <MediaItem key={m.id} m={m} />
          ))}
        </ul>
      ) : (
        <p className="text-[0.88rem] text-muted">No uploads yet.</p>
      )}
      <section>
        <h2 className="mb-3 font-sans text-[1rem] font-semibold tracking-normal text-forest">Built-in images</h2>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
          {bundled.map((b) => (
            <li key={b.url} className="overflow-hidden rounded-xl border border-line bg-paper">
              <div className="relative aspect-square bg-cream-deep">
                <Image src={b.url} alt={b.alt} fill sizes="140px" className="object-contain" />
              </div>
              <div className="p-2">
                <CopyButton text={b.url} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
