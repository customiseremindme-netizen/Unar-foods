import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy with a fresh random nonce on every page view.
 * Only scripts that Next.js itself adds (they carry the nonce) and scripts
 * those load (the Razorpay payment window) may run. A script slipped into a
 * page by an attacker has no nonce, so the browser refuses it.
 */
export function proxy(request: NextRequest) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  const dev = process.env.NODE_ENV === "development";
  const testRun = process.env.UNAR_ALLOW_TEST_OVERRIDES === "1";

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' lets trusted scripts load others (Razorpay Checkout); the
    // host list is only a fallback for older browsers.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://checkout.razorpay.com${dev ? " 'unsafe-eval'" : ""}`,
    // Animations set inline style attributes, so styles stay 'unsafe-inline'
    // (styles can't run code).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.razorpay.com",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.razorpay.com https://lumberjack.razorpay.com",
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://api.razorpay.com",
    "frame-ancestors 'none'",
    // Local test runs use plain http://localhost.
    ...(process.env.NODE_ENV === "production" && !testRun ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not API routes (webhooks, uploads), build files or files in /public.
      source: "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|txt|xml|webmanifest|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
