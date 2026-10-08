import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let supabaseHost: URL | null = null;
try {
  supabaseHost = supabaseUrl ? new URL(supabaseUrl) : null;
} catch {
  supabaseHost = null;
}
const isLocalSupabase =
  supabaseHost !== null && ["127.0.0.1", "localhost"].includes(supabaseHost.hostname);

/**
 * Security headers applied to every response.
 * The Content-Security-Policy allows Razorpay Checkout (payment window) and
 * Supabase (database/auth/storage) and nothing else.
 */
const supabaseOrigin = supabaseHost ? supabaseHost.origin : "";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin} https://*.razorpay.com`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} https://*.razorpay.com https://lumberjack.razorpay.com`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://api.razorpay.com",
  "frame-ancestors 'none'",
  ...(process.env.NODE_ENV === "production" && !isLocalSupabase ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\" \"https://api.razorpay.com\")" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // This project uses the classic Next.js caching model: public pages are
  // statically generated and refreshed when the admin publishes changes.
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75, 85],
    remotePatterns: supabaseHost
      ? [
          {
            protocol: supabaseHost.protocol.replace(":", "") as "http" | "https",
            hostname: supabaseHost.hostname,
            port: supabaseHost.port,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
    // Only needed when developing against a local Supabase instance.
    dangerouslyAllowLocalIP: isLocalSupabase,
  },
  serverExternalPackages: ["sharp"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
