"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Star } from "lucide-react";
import { submitReviewAction, type FormState } from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FormMessage, Input, Textarea } from "@/components/ui/field";
import { validateReviewFiles } from "@/lib/reviews/media-policy";
import { ReviewMedia, type ReviewMediaItem } from "./review-media";
import { cn } from "@/lib/utils";

const initial: FormState = { ok: false, message: null };

export function ReviewForm({ productId, productSlug }: { productId: string; productSlug: string }) {
  const [state, action, pending] = useActionState(submitReviewAction, initial);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [media, setMedia] = useState<ReviewMediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const error = validateReviewFiles(files);
    if (error) { setUploadMessage(error); return; }
    setUploading(true);
    setUploadMessage("");
    try {
      const body = new FormData();
      for (const file of files) body.append("files", file);
      const response = await fetch("/api/review-media", { method: "POST", body });
      const result = await response.json() as { media?: ReviewMediaItem[]; error?: string };
      if (!response.ok || !result.media) throw new Error(result.error || "Your files could not be uploaded.");
      setMedia(result.media);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) { setUploadMessage(error instanceof Error ? error.message : "Please try uploading again."); }
    finally { setUploading(false); }
  }

  if (state.ok) return <FormMessage tone="success">{state.message}</FormMessage>;

  const needsLogin = state.message?.toLowerCase().includes("sign in");

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="media_ids" value={JSON.stringify(media.map((item) => item.id))} />
      <input type="hidden" name="rating" value={rating || ""} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
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
          <Input id="review-name" name="author_name" autoComplete="given-name" maxLength={60} aria-invalid={!!state.errors?.author_name} />
        </Field>
        <Field label="Title (optional)" htmlFor="review-title" error={state.errors?.title}>
          <Input id="review-title" name="title" maxLength={120} />
        </Field>
      </div>
      <Field label="Your review" htmlFor="review-body" required error={state.errors?.body}>
        <Textarea id="review-body" name="body" rows={4} maxLength={2000} aria-invalid={!!state.errors?.body} />
      </Field>
      <Field label="Photos or video (optional)" htmlFor="review-files" hint="Up to five photos (2 MB each) and one MP4 video (8 MB, 30 seconds). Files appear only after your review is approved.">
        <Input id="review-files" ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,video/mp4" disabled={uploading || pending} onChange={(e) => { setFiles(Array.from(e.currentTarget.files || [])); setUploadMessage(""); }} />
      </Field>
      {files.length > 0 ? <div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" loading={uploading} onClick={upload}>Upload files</Button><Button type="button" variant="secondary" disabled={uploading} onClick={() => { setFiles([]); if (inputRef.current) inputRef.current.value = ""; }}>Clear selection</Button></div> : null}
      {uploadMessage ? <FormMessage tone="error">{uploadMessage}</FormMessage> : null}
      <ReviewMedia items={media} />
      {media.length > 0 ? <button type="button" onClick={() => setMedia([])} disabled={uploading || pending} className="min-h-11 text-[0.85rem] text-forest underline">Remove uploaded files</button> : null}
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
        <Button type="submit" loading={pending} disabled={uploading || files.length > 0}>
          Submit review
        </Button>
        <p className="text-[0.78rem] text-muted">You need to be signed in. Reviews are checked before they appear.</p>
      </div>
    </form>
  );
}
