import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow:     "/",
        disallow:  [
          "/admin/",    // 管理画面はクロール不要
          "/api/",      // APIエンドポイント
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
