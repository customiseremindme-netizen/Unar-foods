"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { deleteCategoryAction, saveCategoryAction } from "@/app/admin/_actions/products";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { slugify } from "@/lib/validation/common";
import { ActionButton, AdminForm, useFieldError } from "./forms";
import { Card } from "./ui";

type Category = { id: string; name: string; slug: string; description: string; sort_order: number; is_active: boolean; products: number };

function CategoryFields({ c }: { c?: Category }) {
  const [name, setName] = useState(c?.name ?? "");
  const [slug, setSlug] = useState(c?.slug ?? "");
  const nameError = useFieldError("name");
  const slugError = useFieldError("slug");
  const prefix = c?.id ?? "new";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={c?.id ?? ""} />
      <div>
        <Label htmlFor={`${prefix}-name`}>Name</Label>
        <Input
          id={`${prefix}-name`}
          name="name"
          value={name}
          maxLength={80}
          onChange={(e) => {
            setName(e.target.value);
            if (!c) setSlug(slugify(e.target.value));
          }}
          className="h-11"
          aria-invalid={!!nameError || undefined}
        />
        {nameError ? <p className="mt-1 text-[0.78rem] text-danger">{nameError}</p> : null}
      </div>
      <div>
        <Label htmlFor={`${prefix}-slug`}>Web address</Label>
        <Input id={`${prefix}-slug`} name="slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} className="h-11" aria-invalid={!!slugError || undefined} />
        <p className="mt-1 text-[0.75rem] text-muted">Used in the shop filter: /shop?collection={slug || "…"}</p>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${prefix}-description`}>Description (optional)</Label>
        <Textarea id={`${prefix}-description`} name="description" rows={2} maxLength={500} defaultValue={c?.description ?? ""} />
      </div>
      <div>
        <Label htmlFor={`${prefix}-sort`}>Sort order</Label>
        <Input id={`${prefix}-sort`} name="sort_order" type="number" min={0} max={9999} defaultValue={c?.sort_order ?? 0} className="h-11 w-28" />
      </div>
      <div className="flex items-end pb-3">
        <Checkbox name="is_active" defaultChecked={c?.is_active ?? true} label="Show in the shop" />
      </div>
    </div>
  );
}

export function CollectionsManager({ categories, canWrite }: { categories: Category[]; canWrite: boolean }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-5">
      {categories.map((c) => (
        <Card
          key={c.id}
          title={c.name}
          description={`${c.products} product${c.products === 1 ? "" : "s"}`}
          actions={c.is_active ? <Badge tone="success">Visible</Badge> : <Badge tone="muted">Hidden</Badge>}
        >
          <AdminForm action={saveCategoryAction}>
            <fieldset disabled={!canWrite}>
              <CategoryFields c={c} />
              {canWrite ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    action={() => deleteCategoryAction(c.id)}
                    confirm={`Delete the collection “${c.name}”? Products in it are not deleted.`}
                  >
                    Delete
                  </ActionButton>
                </div>
              ) : null}
            </fieldset>
          </AdminForm>
        </Card>
      ))}
      {canWrite ? (
        adding ? (
          <Card title="New collection">
            <AdminForm action={saveCategoryAction} onSuccess={() => setAdding(false)}>
              <CategoryFields />
              <div className="mt-4 flex gap-2">
                <Button type="submit" size="sm">
                  Add collection
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </AdminForm>
          </Card>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" aria-hidden="true" /> New collection
          </Button>
        )
      ) : null}
    </div>
  );
}
