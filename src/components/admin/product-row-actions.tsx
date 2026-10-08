"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { deleteProductAction, duplicateProductAction, setProductStatusAction } from "@/app/admin/_actions/products";
import { useAdminAction } from "./forms";

type Status = "draft" | "published" | "archived";

/** Small “…” menu on each product row: view, duplicate, publish/unpublish, archive, delete. */
export function ProductRowActions({ id, slug, status }: { id: string; slug: string; status: Status }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { run, pending } = useAdminAction();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "block w-full px-4 py-2 text-left text-[0.84rem] hover:bg-cream disabled:opacity-50";
  const act = async (fn: () => Promise<{ ok: boolean; message: string | null; data?: unknown }>) => {
    setOpen(false);
    return run(fn);
  };

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Product actions"
        disabled={pending}
        className="grid size-9 place-items-center rounded-full hover:bg-forest/[0.06] disabled:opacity-50"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-lg">
          {status === "published" ? (
            <a role="menuitem" href={`/products/${slug}`} target="_blank" rel="noreferrer" className={item}>
              View on website
            </a>
          ) : (
            <a role="menuitem" href={`/api/preview?path=${encodeURIComponent(`/products/${slug}`)}`} target="_blank" rel="noreferrer" className={item}>
              Preview draft
            </a>
          )}
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={async () => {
              const r = await act(() => duplicateProductAction(id));
              if (r.ok && typeof r.data === "string") router.push(`/admin/products/${r.data}`);
            }}
          >
            Duplicate
          </button>
          {status !== "published" ? (
            <button role="menuitem" type="button" className={item} onClick={() => act(() => setProductStatusAction(id, "published"))}>
              Publish
            </button>
          ) : (
            <button role="menuitem" type="button" className={item} onClick={() => act(() => setProductStatusAction(id, "draft"))}>
              Unpublish (move to drafts)
            </button>
          )}
          {status !== "archived" ? (
            <button role="menuitem" type="button" className={item} onClick={() => act(() => setProductStatusAction(id, "archived"))}>
              Archive
            </button>
          ) : null}
          {status !== "published" ? (
            <button
              role="menuitem"
              type="button"
              className={`${item} text-danger`}
              onClick={() => {
                if (window.confirm("Delete this product permanently? Past orders keep their own copy of the details.")) void act(() => deleteProductAction(id));
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
