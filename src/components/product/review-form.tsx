"use client";

import Link from "next/link";
/* eslint-disable @next/next/no-img-element -- previews of the customer's own, not-yet-saved uploads */
import { useActionState, useRef, useState } from "react";
import { ImagePlus, Loader2, Star, Video, X } from "lucide-react";
import { submitReviewAction, type FormState } from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FormMessage, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const initial: FormState = { ok: false, message: null };

type Upload = { key: string; name: string; kind: "image" | "video"; status: "uploading" | "done" | "error"; id?: string; preview?: string; error?: string };

const MAX_PHOTOS = 5;
const PHOTO_BYTES = 10 * 1024 * 1024;
const VIDEO_BYTES = 25 * 1024 * 1024;

/** Shrinks big phone photos in the browser so uploads are quick (the server re-encodes again). */
async function shrinkPhoto(file: File): Promise<File> {
  if (file.size < 2 * 1024 * 1024 || !("createImageBitmap" in window)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/** Optional photos (up to 5) and one video, uploaded as soon as they are chosen. */
function MediaPicker({ uploads, setUploads, allowPhotos, allowVideo }: { uploads: Upload[]; setUploads: (fn: (u: Upload[]) => Upload[]) => void; allowPhotos: boolean; allowVideo: boolean }) {
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const photos = uploads.filter((u) => u.kind === "image" && u.status !== "error").length;
  const videos = uploads.filter((u) => u.kind === "video" && u.status !== "error").length;

  async function send(file: File, kind: "image" | "video") {
    const key = `${Date.now()}-${Math.random()}`;
    const preview = kind === "image" ? URL.createObjectURL(file) : undefined;
    const tooBig = kind === "image" ? file.size > PHOTO_BYTES * 3 : file.size > VIDEO_BYTES;
    if (tooBig) {
      setUploads((u) => [...u, { key, name: file.name, kind, status: "error", error: kind === "video" ? "Videos can be up to 25 MB." : "This photo is too large." }]);
      return;
    }
    setUploads((u) => [...u, { key, name: file.name, kind, status: "uploading", preview }]);
    try {
      const body = new FormData();
      body.set("file", kind === "image" ? await shrinkPhoto(file) : file);
      const res = await fetch("/api/reviews/media", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(json.error || "Upload failed. Please try again.");
      setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: "done", id: json.id } : x)));
    } catch (error) {
      setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: "error", error: (error as Error).message } : x)));
    }
  }

  if (!allowPhotos && !allowVideo) return null;
  return (
    <fieldset>
      <legend className="mb-2 text-[0.82rem] font-semibold">Photos or a video (optional)</legend>
      <div className="flex flex-wrap gap-2">
        {allowPhotos ? (
          <>
            <input
              ref={photoInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
              multiple
              className="sr-only"
              aria-label="Add photos"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - photos);
                files.forEach((f) => void send(f, "image"));
                e.target.value = "";
              }}
            />
            <Button type="button" variant="secondary" size="sm" disabled={photos >= MAX_PHOTOS} onClick={() => photoInput.current?.click()}>
              <ImagePlus className="size-4" aria-hidden="true" /> Add photos ({photos}/{MAX_PHOTOS})
            </Button>
          </>
        ) : null}
        {allowVideo ? (
          <>
            <input
              ref={videoInput}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="sr-only"
              aria-label="Add a video"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void send(file, "video");
                e.target.value = "";
              }}
            />
            <Button type="button" variant="secondary" size="sm" disabled={videos >= 1} onClick={() => videoInput.current?.click()}>
              <Video className="size-4" aria-hidden="true" /> Add a video
            </Button>
          </>
        ) : null}
      </div>
      <p className="mt-1.5 text-[0.75rem] text-muted">Up to 5 photos (JPG, PNG, WebP, HEIC) and one video (MP4, MOV or WebM, up to 25 MB).</p>
      {uploads.length ? (
        <ul className="mt-3 flex flex-wrap gap-3" aria-label="Your uploads">
          {uploads.map((u) => (
            <li key={u.key} className="relative">
              <div className={cn("relative grid size-20 place-items-center overflow-hidden rounded-xl bg-cream-deep ring-1", u.status === "error" ? "ring-danger" : "ring-line")}>
                {u.preview ? <img src={u.preview} alt="" className="size-full object-cover" /> : <Video className="size-6 text-forest" aria-hidden="true" />}
                {u.status === "uploading" ? (
                  <span className="absolute inset-0 grid place-items-center bg-paper/70">
                    <Loader2 className="size-5 animate-spin text-forest" aria-label="Uploading" />
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))}
                className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-forest text-cream shadow-soft"
                aria-label={`Remove ${u.name}`}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
              {u.status === "error" ? <p className="mt-1 w-20 text-[0.68rem] leading-tight text-danger">{u.error}</p> : null}
              {u.id ? <input type="hidden" name="media_id" value={u.id} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}

export function ReviewForm({
  productId,
  productSlug,
  allowPhotos = true,
  allowVideo = true,
}: {
  productId: string;
  productSlug: string;
  allowPhotos?: boolean;
  allowVideo?: boolean;
}) {
  const [state, action, pending] = useActionState(submitReviewAction, initial);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const uploading = uploads.some((u) => u.status === "uploading");

  if (state.ok) return <FormMessage tone="success">{state.message}</FormMessage>;

  const needsLogin = state.message?.toLowerCase().includes("sign in");

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <input name="hp_check" tabIndex={-1} autoComplete="off" />
      </div>
      <fieldset>
        <legend className="mb-2 text-[0.82rem] font-semibold">
          Your rating <span className="text-danger" aria-hidden="true">*</span>
        </legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={rating === n}
              className="rounded-md p-1"
            >
              <Star
                aria-hidden="true"
                className={cn("size-7 transition-colors", n <= (hover || rating) ? "fill-banana text-banana" : "text-line")}
                strokeWidth={1.4}
              />
            </button>
          ))}
        </div>
        <FieldError message={state.errors?.rating} />
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name (shown publicly)" htmlFor="review-name" required error={state.errors?.author_name}>
          <Input id="review-name" name="author_name" defaultValue={state.values?.author_name} autoComplete="given-name" maxLength={60} aria-invalid={!!state.errors?.author_name} />
        </Field>
        <Field label="Title (optional)" htmlFor="review-title" error={state.errors?.title}>
          <Input id="review-title" name="title" defaultValue={state.values?.title} maxLength={120} />
        </Field>
      </div>
      <Field label="Your review" htmlFor="review-body" required error={state.errors?.body}>
        <Textarea id="review-body" name="body" defaultValue={state.values?.body} rows={4} maxLength={2000} aria-invalid={!!state.errors?.body} />
      </Field>
      <MediaPicker uploads={uploads} setUploads={setUploads} allowPhotos={allowPhotos} allowVideo={allowVideo} />
      {state.message ? (
        <FormMessage tone="error">
          {state.message}{" "}
          {needsLogin ? (
            <Link href={`/login?next=${encodeURIComponent(`/products/${productSlug}#reviews`)}`} className="font-semibold underline">
              Sign in
            </Link>
          ) : null}
        </FormMessage>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={pending} disabled={uploading}>
          {uploading ? "Uploading…" : "Submit review"}
        </Button>
        <p className="text-[0.78rem] text-muted">You need to be signed in. Reviews are checked before they appear.</p>
      </div>
    </form>
  );
}
