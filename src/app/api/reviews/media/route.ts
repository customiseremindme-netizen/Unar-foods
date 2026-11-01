import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAllSettings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/request";
import { ReviewMediaError, storeReviewMedia } from "@/lib/reviews/media";
import { logError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/** One photo or video for a review, uploaded by a signed-in customer before they submit it. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in to add photos or a video." }, { status: 401 });
  if (!(await checkRateLimit("reviewMedia", user.id))) {
    return NextResponse.json({ error: "You've uploaded a lot in a short time. Please try again later." }, { status: 429 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 26 * 1024 * 1024) return NextResponse.json({ error: "This file is too large. Videos can be up to 25 MB." }, { status: 413 });
  const settings = await getAllSettings();
  if (!settings.reviews.enabled) return NextResponse.json({ error: "Reviews are currently closed." }, { status: 403 });

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "We couldn't read that file. Please try again." }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "Please choose a photo or video." }, { status: 400 });
  const isVideo = file.type.startsWith("video/");
  if (isVideo && !settings.reviews.allow_video) return NextResponse.json({ error: "Videos can't be added to reviews right now." }, { status: 403 });
  if (!isVideo && !settings.reviews.allow_photos) return NextResponse.json({ error: "Photos can't be added to reviews right now." }, { status: 403 });

  try {
    const stored = await storeReviewMedia(file, user.id);
    if ((stored.kind === "video" && !settings.reviews.allow_video) || (stored.kind === "image" && !settings.reviews.allow_photos)) {
      return NextResponse.json({ error: "This type of file can't be added right now." }, { status: 403 });
    }
    return NextResponse.json(stored);
  } catch (error) {
    if (error instanceof ReviewMediaError) return NextResponse.json({ error: error.message }, { status: 400 });
    logError("reviews.media_upload", error);
    return NextResponse.json({ error: "We couldn't save that file. Please try again." }, { status: 500 });
  }
}
