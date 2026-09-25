import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.gci-index.com";

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
      {
        // PetalBot (Huawei Petal Search): 1日400件超クロールするが日本市場への
        // 流入ゼロのため拒否（2026-09-25、Firewall実測に基づく）
        userAgent: "PetalBot",
        disallow:  "/",
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
