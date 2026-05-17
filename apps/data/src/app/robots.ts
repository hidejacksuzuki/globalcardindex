import type { MetadataRoute } from "next";

/**
 * gci-data.com は内部管理ツール — クローラーを完全にブロックする。
 * X-Robots-Tag: noindex ヘッダー（next.config.js）と二重の保護。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow:  "/",
      },
    ],
  };
}
