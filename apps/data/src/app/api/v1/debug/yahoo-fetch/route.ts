/**
 * GET /api/v1/debug/yahoo-fetch?keyword=XXX
 *
 * Yahoo closedsearch の実レスポンスを診断する。
 * - HTTP ステータス
 * - 先頭 2000 文字の HTML スニペット
 * - parseClosedAuctionHtml の結果
 *
 * Admin 専用 (referer /admin/ or CRON_SECRET)
 */

import { NextRequest, NextResponse }            from "next/server";
import { timingSafeEqual,
         buildServerClosedSearchUrl,
         parseClosedAuctionHtml }               from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret  = process.env.CRON_SECRET ?? "";
  const auth    = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const keyword = req.nextUrl.searchParams.get("keyword") ?? "ピカチュウ";
  const url     = buildServerClosedSearchUrl(keyword);

  const FETCH_HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ja-JP,ja;q=0.9",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Cache-Control":   "no-cache",
  };

  let httpStatus = 0;
  let htmlSnippet = "";
  let htmlLength  = 0;
  let items: unknown[] = [];
  let fetchError  = "";

  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal:  AbortSignal.timeout(15_000),
    });

    httpStatus  = res.status;
    const html  = await res.text();
    htmlLength  = html.length;
    htmlSnippet = html.slice(0, 3000); // 先頭 3000 文字
    items       = parseClosedAuctionHtml(html, 5);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    ok:         true,
    keyword,
    fetchUrl:   url,
    httpStatus,
    htmlLength,
    htmlSnippet,
    parsedCount: items.length,
    items,
    fetchError: fetchError || null,
  });
}
