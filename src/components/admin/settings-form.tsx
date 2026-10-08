"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveSettingAction } from "@/app/admin/_actions/settings";
import type { SettingsKey } from "@/lib/settings/schema";
import { paiseToRupeesInput, rupeesToPaise } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/field";
import { useAdminAction } from "./forms";
import { ImageField } from "./image-field";
import { Card } from "./ui";

type Value = Record<string, unknown>;

export type SettingField =
  | { name: string; label: string; type: "text" | "email" | "url"; help?: ReactNode; max?: number; placeholder?: string }
  | { name: string; label: string; type: "textarea"; help?: ReactNode; max?: number; rows?: number }
  | { name: string; label: string; type: "boolean"; help?: ReactNode }
  | { name: string; label: string; type: "number"; help?: ReactNode; min?: number; max?: number; step?: number }
  /** stored in paise, edited in rupees; nullable when `optional` */
  | { name: string; label: string; type: "rupees"; help?: ReactNode; optional?: boolean }
  /** string[] edited one per line */
  | { name: string; label: string; type: "lines"; help?: ReactNode; rows?: number; placeholder?: string }
  | { name: string; label: string; type: "color"; help?: ReactNode }
  | { name: string; label: string; type: "image"; help?: string; allowSvg?: boolean; widthField?: string; heightField?: string }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; help?: ReactNode }
  | { name: string; label: string; type: "links"; help?: ReactNode; max: number }
  | { name: string; label: string; type: "templates"; templates: { key: string; label: string }[] };

function str(v: unknown) {
  return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
}

/**
 * One settings group (a row in the `settings` table) as an editable card.
 * The server validates everything again with the same schema the site uses.
 */
export function SettingsForm({
  settingKey,
  title,
  description,
  initial,
  fields,
  id,
}: {
  settingKey: SettingsKey;
  title: string;
  description?: ReactNode;
  initial: Value;
  fields: SettingField[];
  id?: string;
}) {
  const [value, setValue] = useState<Value>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [rupeeDrafts, setRupeeDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAdminAction();
  const dirty = JSON.stringify(value) !== saved || Object.keys(rupeeDrafts).length > 0;
  const set = (name: string, v: unknown) => setValue((prev) => ({ ...prev, [name]: v }));

  async function submit() {
    const next = { ...value };
    for (const [name, raw] of Object.entries(rupeeDrafts)) {
      const field = fields.find((f) => f.name === name);
      if (raw.trim() === "" && field?.type === "rupees" && field.optional) next[name] = null;
      else {
        const paise = rupeesToPaise(raw);
        if (paise === null) {
          setErrors({ [name]: "Enter an amount in rupees, e.g. 499" });
          return;
        }
        next[name] = paise;
      }
    }
    const result = await run(() => saveSettingAction(settingKey, next));
    setErrors(result.errors ?? {});
    if (result.ok) {
      setValue(next);
      setRupeeDrafts({});
      setSaved(JSON.stringify(next));
    }
  }

  return (
    <Card id={id} title={title} description={description}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="grid gap-5"
      >
        {fields.map((f) => {
          const fid = `${settingKey}-${f.name}`;
          const v = value[f.name];
          const error = Object.entries(errors).find(([k]) => k === f.name || k.startsWith(`${f.name}.`))?.[1];
          const help = "help" in f && f.help ? <p className="mt-1 text-[0.75rem] text-muted">{f.help}</p> : null;
          const err = error ? <p className="mt-1 text-[0.78rem] font-medium text-danger">{error}</p> : null;
          switch (f.type) {
            case "text":
            case "email":
            case "url":
              return (
                <div key={f.name}>
                  <Label htmlFor={fid}>{f.label}</Label>
                  <Input id={fid} type={f.type === "text" ? "text" : f.type} value={str(v)} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} className="h-11" aria-invalid={!!error || undefined} />
                  {help}
                  {err}
                </div>
              );
            case "textarea":
              return (
                <div key={f.name}>
                  <Label htmlFor={fid}>{f.label}</Label>
                  <Textarea id={fid} rows={f.rows ?? 3} value={str(v)} maxLength={f.max} onChange={(e) => set(f.name, e.target.value)} />
                  {help}
                  {err}
                </div>
              );
            case "boolean":
              return (
                <div key={f.name}>
                  <Checkbox id={fid} checked={v === true} onChange={(e) => set(f.name, e.target.checked)} label={f.label} description={f.help} />
                  {err}
                </div>
              );
            case "number":
              return (
                <div key={f.name}>
                  <Label htmlFor={fid}>{f.label}</Label>
                  <Input id={fid} type="number" min={f.min} max={f.max} step={f.step ?? 1} value={str(v)} onChange={(e) => set(f.name, e.target.value === "" ? 0 : Number(e.target.value))} className="h-11 max-w-48" />
                  {help}
                  {err}
                </div>
              );
            case "rupees":
              return (
                <div key={f.name}>
                  <Label htmlFor={fid}>{f.label}</Label>
                  <div className="flex max-w-48 items-center gap-2">
                    <span className="text-muted">₹</span>
                    <Input
                      id={fid}
                      inputMode="decimal"
                      value={f.name in rupeeDrafts ? rupeeDrafts[f.name] : v === null || v === undefined ? "" : paiseToRupeesInput(Number(v))}
                      onChange={(e) => setRupeeDrafts((d) => ({ ...d, [f.name]: e.target.value.replace(/[^\d.]/g, "") }))}
                      className="h-11"
                      placeholder={f.optional ? "Not set" : "0"}
                    />
                  </div>
                  {help}
                  {err}
                </div>
              );
            case "lines":
              return (
                <div key={f.name}>
                  <Label htmlFor={fid}>{f.label}</Label>
                  <Textarea
                    id={fid}
                    rows={f.rows ?? 4}
                    placeholder={f.placeholder}
                    value={Array.isArray(v) ? (v as string[]).join("\n") : ""}
                    onChange={(e) => set(f.name, e.target.value.split("\n").map((x) => x.trimStart()).filter((x, i, all) => x !== "" || i === all.length - 1))}
                    onBlur={(e) => set(f.name, e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))}
                  />
                  {help}
                  {err}
                </div>
              );
            case "color":
              return (
                <div key={f.name}>
                  <Label htmlFor={fid}>{f.label}</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" aria-label={`${f.label} picker`} value={/^#[0-9a-f]{6}$/i.test(str(v)) ? str(v) : "#000000"} onChange={(e) => set(f.name, e.target.value.toUpperCase())} className="size-11 cursor-pointer rounded-lg border border-line bg-paper p-1" />
                    <Input id={fid} value={str(v)} maxLength={7} onChange={(e) => set(f.name, e.target.value)} className="h-11 w-32 font-mono" />
                  </div>
                  {help}
                  {err}
                </div>
              );
            case "image":
              return (
                <div key={f.name}>
                  <ImageField
                    id={fid}
                    label={f.label}
                    value={str(v)}
                    allowSvg={f.allowSvg}
                    folder="brand"
                    help={f.help}
                    onChange={(url, meta) =>
                      setValue((prev) => ({
                        ...prev,
                        [f.name]: url,
                        ...(f.widthField && meta?.width ? { [f.widthField]: meta.width } : {}),
                        ...(f.heightField && meta?.height ? { [f.heightField]: meta.height } : {}),
                      }))
                    }
                  />
                  {err}
                </div>
              );
            case "select":
              return (
                <div key={f.name}>
                  <Label htmlFor={fid}>{f.label}</Label>
                  <Select id={fid} value={str(v)} onChange={(e) => set(f.name, e.target.value)} className="max-w-md">
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                  {help}
                  {err}
                </div>
              );
            case "links":
              return <LinksField key={f.name} id={fid} label={f.label} help={help} error={err} max={f.max} value={Array.isArray(v) ? (v as { label: string; href: string }[]) : []} onChange={(next) => set(f.name, next)} />;
            case "templates":
              return <TemplatesField key={f.name} templates={f.templates} value={(v ?? {}) as Record<string, { enabled: boolean; subject: string; intro: string }>} onChange={(next) => set(f.name, next)} />;
            default:
              return null;
          }
        })}
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" loading={pending} disabled={!dirty}>
            Save
          </Button>
          {dirty ? <span className="text-[0.78rem] text-muted">Unsaved changes</span> : null}
        </div>
      </form>
    </Card>
  );
}

function LinksField({
  id,
  label,
  help,
  error,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help: ReactNode;
  error: ReactNode;
  max: number;
  value: { label: string; href: string }[];
  onChange: (v: { label: string; href: string }[]) => void;
}) {
  const move = (i: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [x] = next.splice(i, 1);
    next.splice(to, 0, x);
    onChange(next);
  };
  return (
    <fieldset className="rounded-xl border border-line p-4">
      <legend className="px-1 text-[0.82rem] font-semibold">{label}</legend>
      {help}
      <ol className="mt-2 grid gap-2">
        {value.map((link, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <Input aria-label={`${label} ${i + 1} text`} value={link.label} maxLength={40} placeholder="Text" onChange={(e) => onChange(value.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))} className="h-10 w-40" />
            <Input aria-label={`${label} ${i + 1} link`} id={`${id}-${i}`} value={link.href} placeholder="/shop" onChange={(e) => onChange(value.map((l, j) => (j === i ? { ...l, href: e.target.value } : l)))} className="h-10 min-w-40 flex-1" />
            <button type="button" className="grid size-8 place-items-center rounded-full hover:bg-forest/[0.06] disabled:opacity-30" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${link.label || "link"} up`}>
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
            <button type="button" className="grid size-8 place-items-center rounded-full hover:bg-forest/[0.06] disabled:opacity-30" disabled={i === value.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${link.label || "link"} down`}>
              <ArrowDown className="size-4" aria-hidden="true" />
            </button>
            <button type="button" className="grid size-8 place-items-center rounded-full text-danger hover:bg-danger-soft" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${link.label || "link"}`}>
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      {value.length < max ? (
        <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => onChange([...value, { label: "", href: "" }])}>
          <Plus className="size-3.5" aria-hidden="true" /> Add link
        </Button>
      ) : null}
      {error}
    </fieldset>
  );
}

function TemplatesField({
  templates,
  value,
  onChange,
}: {
  templates: { key: string; label: string }[];
  value: Record<string, { enabled: boolean; subject: string; intro: string }>;
  onChange: (v: Record<string, { enabled: boolean; subject: string; intro: string }>) => void;
}) {
  return (
    <div className="grid gap-4">
      <p className="text-[0.8rem] text-muted">
        Use <code className="rounded bg-cream-deep px-1">{"{{order_number}}"}</code> to insert the order number. Order details, totals and links are added automatically below your text.
      </p>
      {templates.map((t) => {
        const current = value[t.key] ?? { enabled: true, subject: "", intro: "" };
        const update = (patch: Partial<typeof current>) => onChange({ ...value, [t.key]: { ...current, ...patch } });
        return (
          <fieldset key={t.key} className="rounded-xl border border-line p-4">
            <legend className="px-1 text-[0.82rem] font-semibold">{t.label}</legend>
            <Checkbox checked={current.enabled} onChange={(e) => update({ enabled: e.target.checked })} label="Send this email" />
            <div className="mt-3 grid gap-3">
              <div>
                <Label htmlFor={`tpl-${t.key}-subject`}>Subject</Label>
                <Input id={`tpl-${t.key}-subject`} value={current.subject} maxLength={200} onChange={(e) => update({ subject: e.target.value })} className="h-10" />
              </div>
              <div>
                <Label htmlFor={`tpl-${t.key}-intro`}>Opening text</Label>
                <Textarea id={`tpl-${t.key}-intro`} rows={2} value={current.intro} maxLength={1000} onChange={(e) => update({ intro: e.target.value })} />
              </div>
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
