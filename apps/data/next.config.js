/** @type {import('next').NextConfig} */
const path = require("path");

// ── Security headers for gci-data.com (internal admin + cron app) ────────────
const SECURITY_HEADERS = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options",    value: "nosniff" },
  // Block framing — admin UI must never be embeddable
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "Referrer-Policy",           value: "no-referrer" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-XSS-Protection",          value: "1; mode=block" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Hard noindex for the entire data app — belt + suspenders alongside robots.ts
  { key: "X-Robots-Tag",              value: "noindex, nofollow, noarchive" },
];

const nextConfig = {
  reactStrictMode: true,

  // Required so Next.js compiles TypeScript from workspace packages
  transpilePackages: ["@gci/core", "@gci/db", "@gci/email"],

  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    outputFileTracingIncludes: {
      "/**": [
        "../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/**",
        "../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/**",
      ],
    },
  },

  // gci-data.com — private internal app
  // Routes: /admin/*, /api/v1/cron/*, /api/v1/webhooks/*

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

module.exports = nextConfig;
