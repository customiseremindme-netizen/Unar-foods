"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import { listMediaAction, uploadMediaAction } from "@/app/admin/_actions/media";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type PickedImage = { url: string; width: number | null; height: number | null; alt?: string };

/**
 * Shrinks very large photos in the browser before upload (keeps uploads
 * under hosting limits and makes them fast). The server re-encodes again.
 */
async function prepareFile(file: File): Promise<File> {
  if (file.type === "image/svg+xml" || file.size < 3.5 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" }) : file;
}

export function useImageUpload(folder: string, allowSvg = false) {
  const { notify } = useToast();
  const [uploading, setUploading] = useState(false);
  async function upload(file: File, alt = ""): Promise<PickedImage | null> {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", await prepareFile(file));
      fd.set("folder", folder);
      fd.set("alt", alt);
      if (allowSvg) fd.set("allowSvg", "1");
      const result = await uploadMediaAction(fd);
      if (!result.ok || !result.data) {
        notify(result.message ?? "Upload failed.", "error");
        return null;
      }
      notify("Image uploaded.", "success");
      return { url: result.data.url, width: result.data.width, height: result.data.height, alt };
    } catch {
      notify("Upload failed — the file may be too large.", "error");
      return null;
    } finally {
      setUploading(false);
    }
  }
  return { upload, uploading };
}

export function MediaPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (img: PickedImage) => void }) {
  const [items, setItems] = useState<{ id: string; url: string; alt: string; width: number | null; height: number | null }[] | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void listMediaAction().then((r) => active && setItems(r.data ?? []));
    return () => {
      active = false;
    };
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} side="center" title="Choose from media library" labelledBy="media-picker-title">
      <div className="p-5">
        {items === null ? (
          <p className="text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-muted">No uploaded images yet. Use “Upload” to add one.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick({ url: m.url, width: m.width, height: m.height, alt: m.alt });
                    onClose();
                  }}
                  className="relative block aspect-square w-full overflow-hidden rounded-xl bg-cream-deep ring-1 ring-line hover:ring-2 hover:ring-forest"
                  aria-label={`Use image ${m.alt || m.url.split("/").pop()}`}
                >
                  <Image src={m.url} alt="" fill sizes="160px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

/** Image input used across the dashboard: upload, pick from library, or paste a site path. */
export function ImageField({
  label,
  value,
  onChange,
  folder = "content",
  allowSvg = false,
  help,
  id,
}: {
  label: string;
  value: string;
  onChange: (url: string, meta?: PickedImage) => void;
  folder?: string;
  allowSvg?: boolean;
  help?: string;
  id: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useImageUpload(folder, allowSvg);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isSvg = value.toLowerCase().endsWith(".svg");

  return (
    <div>
      <p id={`${id}-label`} className="mb-1.5 text-[0.82rem] font-semibold">
        {label}
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <div className={cn("relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-cream-deep ring-1 ring-line")}>
          {value ? (
            <Image src={value} alt="" fill sizes="112px" className="object-contain" unoptimized={isSvg} />
          ) : (
            <ImageIcon className="size-6 text-muted" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={allowSvg ? "image/*,.svg" : "image/jpeg,image/png,image/webp,image/avif"}
              className="hidden"
              aria-labelledby={`${id}-label`}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const result = await upload(file);
                if (result) onChange(result.url, result);
              }}
            />
            <Button type="button" size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="size-3.5" aria-hidden="true" /> Upload
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
              Media library
            </Button>
            {value ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
                <X className="size-3.5" aria-hidden="true" /> Remove
              </Button>
            ) : null}
          </div>
          <input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/images/… or https://…"
            className="h-9 w-full rounded-lg border border-line bg-cream/40 px-3 text-[0.8rem] text-muted focus:border-forest focus:outline-none"
            aria-label={`${label} address`}
          />
          {help ? <p className="text-[0.75rem] text-muted">{help}</p> : null}
        </div>
      </div>
      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(img) => onChange(img.url, img)} />
    </div>
  );
}
