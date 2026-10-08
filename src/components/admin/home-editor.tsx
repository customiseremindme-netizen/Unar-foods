"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { discardHomeDraftAction, publishHomeAction, saveHomeDraftAction } from "@/app/admin/_actions/content";
import { SECTION_TYPES, isSectionType, type SectionType } from "@/lib/cms/sections";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SchemaFields } from "./schema-form";
import { StickySaveBar, useAdminAction, useUnsavedWarning } from "./forms";
import { Notice } from "./ui";

export type EditorSection = { key: string; type: string; is_visible: boolean; content: Record<string, unknown> };

function sectionTitle(s: EditorSection) {
  const heading = (s.content.headline ?? s.content.heading ?? "") as string;
  return heading ? `“${heading.length > 60 ? `${heading.slice(0, 60)}…` : heading}”` : "";
}

export function HomeEditor({
  initial,
  hasUnpublished,
  lastPublished,
  products,
}: {
  initial: EditorSection[];
  hasUnpublished: boolean;
  lastPublished: string | null;
  products: { slug: string; title: string }[];
}) {
  const [sections, setSections] = useState(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [newType, setNewType] = useState<SectionType>("story_split");
  const { run, pending } = useAdminAction();
  const dirty = JSON.stringify(sections) !== saved;
  useUnsavedWarning(dirty);

  const update = (i: number, patch: Partial<EditorSection>) => setSections((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, to: number) =>
    setSections((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(i, 1);
      next.splice(to, 0, item);
      return next;
    });

  async function saveDraft() {
    const result = await run(() => saveHomeDraftAction(sections));
    if (result.ok) setSaved(JSON.stringify(sections));
    return result.ok;
  }

  return (
    <div className="pb-28">
      <div className="mb-5 grid gap-3">
        {hasUnpublished || dirty ? (
          <Notice tone="warning">The draft has changes that are not live yet. Preview them, then press Publish.</Notice>
        ) : (
          <Notice tone="success">The live homepage matches this draft{lastPublished ? ` (published ${formatDateTime(lastPublished)})` : ""}.</Notice>
        )}
      </div>

      <ol className="space-y-3">
        {sections.map((s, i) => {
          if (!isSectionType(s.type)) return null;
          const def = SECTION_TYPES[s.type];
          const open = openKey === s.key;
          return (
            <li key={s.key} className={cn("rounded-[1.25rem] border bg-paper", open ? "border-forest" : "border-line", !s.is_visible && "opacity-70")}>
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpenKey(open ? null : s.key)}
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-forest">
                      {i + 1}. {def.label}
                    </span>
                    <span className="block truncate text-[0.78rem] text-muted">{sectionTitle(s) || def.description}</span>
                  </span>
                </button>
                {!s.is_visible ? <Badge tone="muted">Hidden</Badge> : null}
                <span className="flex items-center gap-0.5">
                  <button type="button" onClick={() => update(i, { is_visible: !s.is_visible })} className="grid size-9 place-items-center rounded-full hover:bg-forest/[0.06]" aria-label={s.is_visible ? `Hide ${def.label}` : `Show ${def.label}`} title={s.is_visible ? "Hide" : "Show"}>
                    {s.is_visible ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
                  </button>
                  <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} className="grid size-9 place-items-center rounded-full hover:bg-forest/[0.06] disabled:opacity-30" aria-label={`Move ${def.label} up`}>
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" disabled={i === sections.length - 1} onClick={() => move(i, i + 1)} className="grid size-9 place-items-center rounded-full hover:bg-forest/[0.06] disabled:opacity-30" aria-label={`Move ${def.label} down`}>
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Remove the “${def.label}” section? (You can discard the draft to undo.)`)) setSections((list) => list.filter((_, j) => j !== i));
                    }}
                    className="grid size-9 place-items-center rounded-full text-danger hover:bg-danger-soft"
                    aria-label={`Remove ${def.label}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </span>
              </div>
              {open ? (
                <div className="border-t border-line px-4 py-5 sm:px-6">
                  <p className="mb-4 text-[0.82rem] text-muted">{def.description}</p>
                  <SchemaFields fields={def.fields} value={s.content} onChange={(content) => update(i, { content })} idPrefix={`sec-${s.key}`} products={products} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-wrap items-end gap-2 rounded-[1.25rem] border border-dashed border-line p-4">
        <label className="text-[0.8rem] font-semibold">
          Add a section
          <Select value={newType} onChange={(e) => setNewType(e.target.value as SectionType)} className="mt-1 h-10 w-64 py-0 text-[0.88rem]">
            {(Object.keys(SECTION_TYPES) as SectionType[]).map((t) => (
              <option key={t} value={t}>
                {SECTION_TYPES[t].label}
              </option>
            ))}
          </Select>
        </label>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            const key = `${newType.replace(/_/g, "-")}-${Math.random().toString(36).slice(2, 7)}`;
            setSections((list) => [...list, { key, type: newType, is_visible: true, content: {} }]);
            setOpenKey(key);
          }}
        >
          <Plus className="size-3.5" aria-hidden="true" /> Add
        </Button>
      </div>

      <StickySaveBar dirty={dirty}>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={async () => {
            if (!window.confirm("Throw away all draft changes and go back to the live homepage?")) return;
            const r = await run(() => discardHomeDraftAction());
            if (r.ok) window.location.reload();
          }}
        >
          Discard draft
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={pending}
          onClick={async () => {
            const win = window.open("about:blank", "_blank");
            if (dirty && !(await saveDraft())) {
              win?.close();
              return;
            }
            if (win) win.location.href = "/api/preview?path=/";
          }}
        >
          Save &amp; preview
        </Button>
        <Button type="button" size="sm" variant="secondary" loading={pending} disabled={!dirty} onClick={saveDraft}>
          Save draft
        </Button>
        <Button
          type="button"
          size="sm"
          loading={pending}
          onClick={async () => {
            if (dirty && !(await saveDraft())) return;
            if (!window.confirm("Publish the homepage? Visitors will see these changes immediately.")) return;
            await run(() => publishHomeAction());
          }}
        >
          Publish
        </Button>
      </StickySaveBar>
    </div>
  );
}
