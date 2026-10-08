"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { ICON_NAMES, type FieldDef } from "@/lib/cms/sections";
import { CMS_ICONS } from "@/components/brand/icons";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { ImageField } from "./image-field";

type Json = Record<string, unknown>;

function asString(v: unknown): string {
  return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
}

/**
 * Draws an editing form from a field list (see src/lib/cms/sections.ts).
 * Used for homepage sections, so the owner can edit content without code.
 */
export function SchemaFields({
  fields,
  value,
  onChange,
  idPrefix,
  products = [],
}: {
  fields: FieldDef[];
  value: Json;
  onChange: (next: Json) => void;
  idPrefix: string;
  products?: { slug: string; title: string }[];
}) {
  const set = (name: string, v: unknown) => onChange({ ...value, [name]: v });

  return (
    <div className="grid gap-5">
      {fields.map((field) => {
        const id = `${idPrefix}-${field.name}`;
        const v = value[field.name];
        const help = field.help ? <p className="mt-1 text-[0.75rem] text-muted">{field.help}</p> : null;
        switch (field.type) {
          case "text":
            return (
              <div key={field.name}>
                <Label htmlFor={id}>{field.label}</Label>
                <Input id={id} value={asString(v)} maxLength={field.max} onChange={(e) => set(field.name, e.target.value)} />
                {help}
              </div>
            );
          case "textarea":
          case "markdown":
            return (
              <div key={field.name}>
                <Label htmlFor={id}>{field.label}</Label>
                <Textarea id={id} rows={field.type === "markdown" ? 8 : 3} value={asString(v)} maxLength={field.max} onChange={(e) => set(field.name, e.target.value)} />
                {field.type === "markdown" ? (
                  <p className="mt-1 text-[0.75rem] text-muted">Formatting: **bold**, *italic*, [link text](/shop), blank line for a new paragraph.</p>
                ) : null}
                {help}
              </div>
            );
          case "number":
            return (
              <div key={field.name}>
                <Label htmlFor={id}>{field.label}</Label>
                <Input id={id} type="number" min={field.min} max={field.max} value={asString(v)} onChange={(e) => set(field.name, Number(e.target.value))} className="max-w-40" />
                {help}
              </div>
            );
          case "select":
            return (
              <div key={field.name}>
                <Label htmlFor={id}>{field.label}</Label>
                <Select id={id} value={asString(v)} onChange={(e) => set(field.name, e.target.value)}>
                  {field.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                {help}
              </div>
            );
          case "icon": {
            const current = asString(v) || "leaf";
            const Icon = CMS_ICONS[current as keyof typeof CMS_ICONS];
            return (
              <div key={field.name}>
                <Label htmlFor={id}>{field.label}</Label>
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-sage-soft text-forest">{Icon ? <Icon className="size-5" aria-hidden="true" /> : null}</span>
                  <Select id={id} value={current} onChange={(e) => set(field.name, e.target.value)}>
                    {ICON_NAMES.map((n) => (
                      <option key={n} value={n}>
                        {n.replace(/-/g, " ")}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            );
          }
          case "image":
            return (
              <ImageField key={field.name} id={id} label={field.label} value={asString(v)} onChange={(url) => set(field.name, url)} help={field.help} />
            );
          case "link": {
            const link = (v && typeof v === "object" ? v : {}) as { label?: string; href?: string };
            return (
              <fieldset key={field.name} className="rounded-xl border border-line p-4">
                <legend className="px-1 text-[0.82rem] font-semibold">{field.label}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`${id}-label`}>Button text</Label>
                    <Input id={`${id}-label`} value={link.label ?? ""} maxLength={40} onChange={(e) => set(field.name, { ...link, label: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor={`${id}-href`}>Link (e.g. /shop)</Label>
                    <Input id={`${id}-href`} value={link.href ?? ""} onChange={(e) => set(field.name, { ...link, href: e.target.value })} />
                  </div>
                </div>
                <p className="mt-2 text-[0.75rem] text-muted">Leave the text empty to hide the button.</p>
              </fieldset>
            );
          }
          case "products": {
            const selected = Array.isArray(v) ? (v as string[]) : [];
            return (
              <fieldset key={field.name}>
                <legend className="mb-1.5 text-[0.82rem] font-semibold">{field.label}</legend>
                <div className="grid gap-2">
                  {products.length === 0 ? <p className="text-[0.85rem] text-muted">No products yet.</p> : null}
                  {products.map((p) => (
                    <label key={p.slug} className="flex items-center gap-2 text-[0.88rem]">
                      <input
                        type="checkbox"
                        checked={selected.includes(p.slug)}
                        onChange={(e) =>
                          set(field.name, e.target.checked ? [...selected, p.slug] : selected.filter((s) => s !== p.slug))
                        }
                        className="accent-[var(--color-forest)]"
                      />
                      {p.title}
                    </label>
                  ))}
                </div>
                {help}
              </fieldset>
            );
          }
          case "list": {
            const items = Array.isArray(v) ? (v as Json[]) : [];
            const update = (next: Json[]) => set(field.name, next);
            return (
              <fieldset key={field.name} className="rounded-xl border border-line p-4">
                <legend className="px-1 text-[0.82rem] font-semibold">{field.label}</legend>
                {help}
                <ol className="mt-2 space-y-4">
                  {items.map((item, i) => (
                    <li key={i} className="rounded-xl bg-cream/50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[0.8rem] font-semibold text-muted">
                          {field.itemLabel} {i + 1}
                        </span>
                        <span className="flex gap-1">
                          <button type="button" className="grid size-8 place-items-center rounded-full hover:bg-forest/[0.06] disabled:opacity-30" disabled={i === 0} onClick={() => update(items.map((it, j) => (j === i - 1 ? items[i] : j === i ? items[i - 1] : it)))} aria-label="Move up">
                            <ArrowUp className="size-4" aria-hidden="true" />
                          </button>
                          <button type="button" className="grid size-8 place-items-center rounded-full hover:bg-forest/[0.06] disabled:opacity-30" disabled={i === items.length - 1} onClick={() => update(items.map((it, j) => (j === i + 1 ? items[i] : j === i ? items[i + 1] : it)))} aria-label="Move down">
                            <ArrowDown className="size-4" aria-hidden="true" />
                          </button>
                          <button type="button" className="grid size-8 place-items-center rounded-full text-danger hover:bg-danger-soft" onClick={() => update(items.filter((_, j) => j !== i))} aria-label={`Remove ${field.itemLabel.toLowerCase()} ${i + 1}`}>
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </span>
                      </div>
                      <SchemaFields fields={field.fields} value={item} idPrefix={`${id}-${i}`} onChange={(next) => update(items.map((it, j) => (j === i ? next : it)))} />
                    </li>
                  ))}
                </ol>
                {items.length < field.max ? (
                  <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => update([...items, {}])}>
                    <Plus className="size-3.5" aria-hidden="true" /> Add {field.itemLabel.toLowerCase()}
                  </Button>
                ) : null}
              </fieldset>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
