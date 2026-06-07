/** @type {import('next').NextConfig} */
const path = require("path");

// ── Security headers applied to all responses from gci-index.com ─────────────
const SECURITY_HEADERS = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options",    value: "nosniff" },
  // Block framing (clickjacking protection)
  { key: "X-Frame-Options",           value: "DENY" },
  // Use full referrer on same origin, only origin on cross-origin
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  // Minimal permissions — no camera / mic / geolocation
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
  // XSS protection (legacy browsers)
  { key: "X-XSS-Protection",          value: "1; mode=block" },
  // HSTS — 1 year, include subdomains (Vercel handles the TLS cert)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

// ── Extra headers for auth / account pages ────────────────────────────────────
// X-Robots-Tag: belt-and-suspenders noindex in addition to <meta> tags.
// Prevents crawlers from indexing these pages even if the HTML meta is missed.
const AUTH_EXTRA_HEADERS = [
  ...SECURITY_HEADERS,
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  // Prevent caching of session-bearing pages by shared proxies
  { key: "Cache-Control", value: "private, no-store" },
];

const nextConfig = {
  reactStrictMode: true,

  // Required so Next.js compiles TypeScript from workspace packages
  transpilePackages: ["@gci/core", "@gci/db", "@gci/email"],

  // Allow Next.js output file tracing to find pnpm packages at monorepo root
  // Next.js 14: serverComponentsExternalPackages lives under experimental
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    outputFileTracingIncludes: {
      "/**": ["../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/**"],
    },
  },

  // gci-index.com — public-facing app
  // Routes: /[locale]/*, /en/*, /api/*, /feed.xml, /sitemap.xml
  // Locales: ja (default, no prefix), en (/en/*)

  async redirects() {
    return [
      // Legacy root paths — redirect to /ja/* so old bookmarks still work
      // The middleware handles this for most cases; these are belt-and-suspenders.
      {
        source:      "/",
        destination: "/ja",
        permanent:   false,
        missing: [{ type: "cookie", key: "gci_locale", value: "en" }],
      },
    ];
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      {
        // Extra protection for auth and account pages
        source: "/login/:path*",
        headers: AUTH_EXTRA_HEADERS,
      },
      {
        source: "/account/:path*",
        headers: AUTH_EXTRA_HEADERS,
      },
      {
        // Auth.js internal API — no caching, no indexing
        source: "/api/auth/:path*",
        headers: [
          ...SECURITY_HEADERS,
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
