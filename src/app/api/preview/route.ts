import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/session";
import { isSafeInternalPath } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

/**
 * Turns on preview mode so staff can see unpublished drafts on the real site.
 * Only signed-in staff with content or product permission may enable it.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "/";
  const access = await getStaffAccess();
  if (!access?.permissions.has("content.write") && !access?.permissions.has("products.read")) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/admin/content")}`, url.origin));
  }
  (await draftMode()).enable();
  return NextResponse.redirect(new URL(isSafeInternalPath(path) ? path : "/", url.origin));
}
