import "server-only";
import { headers } from "next/headers";

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return (h.get("x-real-ip") ?? "unknown").slice(0, 64);
}

/**
 * Same-origin check for state-changing route handlers (defence against CSRF).
 * Server Actions already get this protection from Next.js.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
