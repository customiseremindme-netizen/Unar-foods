"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { deletePageAction, savePageAction, unpublishPageAction, type PagePayload } from "@/app/admin/_actions/content";
import { publicPathFor } from "@/lib/admin/content-paths";
import { slugify } from "@/lib/validation/common";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldError, Input, Label, Textarea } from "@/components/ui/field";
import { Markdown } from "@/components/ui/markdown";
import { ImageField } from "./image-field";
import { StickySaveBar, useAdminAction, useUnsavedWarning } from "./forms";
import { Card, Notice } from "./ui";

export type EditorPage = Omit<PagePayload, "publish"> & {
  excerpt: string;
  cover_image_url: string;
  cover_image_alt: string;
  author_name: string;
  seo_title: string;
  seo_description: string;
};

export function PageEditor({ initial, isLive, isOwner }: { initial: EditorPage; isLive: boolean; isOwner: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"write" | "preview">("write");
  const { run, pending } = useAdminAction();
  const dirty = JSON.stringify(p) !== saved;
  useUnsavedWarning(dirty);
  const set = <K extends keyof EditorPage>(k: K, v: EditorPage[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const isPolicy = p.kind === "policy";
  const reviewLocked = isPolicy && initial.requires_owner_review && !isOwner;

  async function save(publish: boolean) {
    const result = await run(() => savePageAction({ ...p, publish }), { refresh: false });
    setErrors(result.errors ?? {});
    if (!result.ok) return;
    const next = { ...p, group_id: result.data ?? p.group_id };
    setP(next);
    setSaved(JSON.stringify(next));
    if (!p.group_id && result.data) router.replace(`/admin/content/pages/${result.data}`);
    else router.refresh();
  }

  return (
    <div className="grid gap-6 pb-28 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-6">
        {isPolicy && p.requires_owner_review ? (
          <Notice tone="warning">
            <strong>Owner review required.</strong> This is a starting draft, not legal advice. Fill in every [bracketed] item, have it checked (ideally by a lawyer), then untick “Owner review required”. Until then the website shows a notice on this page.
          </Notice>
        ) : null}
        <Card>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={p.title}
                maxLength={160}
                onChange={(e) => {
                  const title = e.target.value;
                  setP((prev) => ({ ...prev, title, slug: !prev.group_id && (prev.slug === "" || prev.slug === slugify(prev.title)) ? slugify(title) : prev.slug }));
                }}
                aria-invalid={!!errors.title || undefined}
                className="h-11"
              />
              <FieldError message={errors.title} />
            </div>
            <div>
              <Label htmlFor="slug">Web address</Label>
              <div className="flex items-center gap-2">
                <span className="text-[0.82rem] text-muted">{publicPathFor(p.kind, "").replace(/\/$/, "") || ""}/</span>
                <Input id="slug" value={p.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} className="h-10 max-w-sm" aria-invalid={!!errors.slug || undefined} disabled={p.slug === "about" && p.kind === "page"} />
              </div>
              {isLive && p.slug !== initial.slug ? <p className="mt-1 text-[0.78rem] text-danger">Changing the address of a live page breaks existing links.</p> : null}
              <FieldError message={errors.slug} />
            </div>
            {p.kind === "post" ? (
              <div>
                <Label htmlFor="excerpt">Summary (shown in the Journal list)</Label>
                <Textarea id="excerpt" rows={2} maxLength={400} value={p.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
              </div>
            ) : null}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="body_md" className="mb-0">
                  Content
                </Label>
                <div role="tablist" className="flex gap-1 text-[0.78rem]">
                  {(["write", "preview"] as const).map((t) => (
                    <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="rounded-full px-3 py-1 aria-selected:bg-forest aria-selected:text-cream">
                      {t === "write" ? "Write" : "Preview"}
                    </button>
                  ))}
                </div>
              </div>
              {tab === "write" ? (
                <Textarea id="body_md" rows={22} value={p.body_md} onChange={(e) => set("body_md", e.target.value)} className="font-mono text-[0.85rem]" />
              ) : (
                <div className="prose-unar min-h-64 rounded-xl border border-line bg-cream/30 p-5">
                  <Markdown>{p.body_md || "_Nothing written yet._"}</Markdown>
                </div>
              )}
              <p className="mt-1.5 text-[0.75rem] text-muted">
                Formatting: ## Heading, **bold**, *italic*, - bullet list, [link text](/shop). Leave a blank line between paragraphs.
              </p>
            </div>
          </div>
        </Card>

        {p.kind !== "policy" ? (
          <Card title="Cover image" description="Optional. Shown at the top of the page and when shared on social media.">
            <div className="grid gap-4">
              <ImageField id="cover" label="Image" value={p.cover_image_url} onChange={(url, meta) => setP((prev) => ({ ...prev, cover_image_url: url, cover_image_alt: prev.cover_image_alt || meta?.alt || "" }))} />
              <div>
                <Label htmlFor="cover_alt">Image description (alt text)</Label>
                <Input id="cover_alt" value={p.cover_image_alt} maxLength={200} onChange={(e) => set("cover_image_alt", e.target.value)} className="h-11" />
              </div>
            </div>
          </Card>
        ) : null}

        <Card title="Search engines (SEO)" description="Leave empty to use the title and the start of the content.">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="seo_title">Page title ({p.seo_title.length}/60 recommended)</Label>
              <Input id="seo_title" value={p.seo_title} maxLength={120} onChange={(e) => set("seo_title", e.target.value)} className="h-11" />
            </div>
            <div>
              <Label htmlFor="seo_description">Meta description ({p.seo_description.length}/160 recommended)</Label>
              <Textarea id="seo_description" rows={2} maxLength={300} value={p.seo_description} onChange={(e) => set("seo_description", e.target.value)} />
            </div>
          </div>
        </Card>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Card title="Status">
          <p className="text-[0.86rem]">{isLive ? "This page is live on the website." : "Not published yet — only staff can see it."}</p>
          {p.group_id ? (
            <a
              href={isLive && !dirty ? publicPathFor(p.kind, initial.slug) : `/api/preview?path=${encodeURIComponent(publicPathFor(p.kind, initial.slug))}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-forest hover:underline"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" /> Preview saved draft
            </a>
          ) : null}
          {p.kind === "post" ? (
            <div className="mt-4">
              <Label htmlFor="author">Author name (optional)</Label>
              <Input id="author" value={p.author_name} maxLength={80} onChange={(e) => set("author_name", e.target.value)} className="h-10" />
            </div>
          ) : null}
          {isPolicy ? (
            <div className="mt-4">
              <Checkbox
                checked={p.requires_owner_review}
                disabled={reviewLocked}
                onChange={(e) => set("requires_owner_review", e.target.checked)}
                label="Owner review required"
                description={reviewLocked ? "Only the store owner can approve legal wording." : "Untick only after you have checked and approved this text."}
              />
            </div>
          ) : null}
        </Card>
        {p.group_id ? (
          <Card title="More">
            <div className="flex flex-wrap gap-2">
              {isLive ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={async () => {
                    if (window.confirm("Hide this page from the website?")) await run(() => unpublishPageAction(p.group_id!));
                  }}
                >
                  Unpublish
                </Button>
              ) : null}
              {!isPolicy ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  disabled={pending}
                  onClick={async () => {
                    if (!window.confirm("Delete this page permanently?")) return;
                    const r = await run(() => deletePageAction(p.group_id!), { refresh: false });
                    if (r.ok) router.push(p.kind === "post" ? "/admin/content/posts" : "/admin/content/pages");
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}
      </aside>

      <StickySaveBar dirty={dirty}>
        <Button type="button" size="sm" variant="secondary" loading={pending} onClick={() => save(false)} disabled={!dirty && !!p.group_id}>
          Save draft
        </Button>
        <Button type="button" size="sm" loading={pending} onClick={() => save(true)}>
          {isLive ? "Save & update live page" : "Save & publish"}
        </Button>
      </StickySaveBar>
    </div>
  );
}
