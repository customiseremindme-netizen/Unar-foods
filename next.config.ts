import type { NextConfig } from "next";

/**
 * Security headers applied to every response. Pages get their
 * Content-Security-Policy (with a per-request nonce) from src/proxy.ts;
 * API routes, which only return data, get a policy that allows nothing.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\" \"https://api.razorpay.com\")" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Classic caching model. Pages that read the database are rendered when
  // visitors open them (the database is not available while building).
  cacheComponents: false,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75, 85],
  },
  serverExternalPackages: ["sharp", "nodemailer", "mysql2"],
  experimental: {
    // Image uploads in the dashboard (photos are pre-shrunk in the browser).
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
