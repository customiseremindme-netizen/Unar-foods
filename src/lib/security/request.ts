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

/**
 * Reads a request body but stops as soon as it passes `maxBytes`, so a
 * client can't fill the server's memory by leaving out or faking the
 * Content-Length header. Returns null when the body is too large.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    parts.push(value);
  }
  return Buffer.concat(parts, total);
}
