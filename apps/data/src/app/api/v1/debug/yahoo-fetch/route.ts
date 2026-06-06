/**
 * GET /api/v1/debug/yahoo-fetch?keyword=XXX
 *
 * Yahoo closedsearch の実レスポンスを診断する。
 * __NEXT_DATA__ JSON を抽出してパーサーの修正に使う。
 */

import { NextRequest, NextResponse } from "next/server";
import { parseClosedAuctionHtml, buildServerClosedSearchUrl } from "@gci/core";

export const dynamic = "force-dynamic";

const FETCH_HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "ja-JP,ja;q=0.9",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Cache-Control":   "no-cache",
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const keyword = req.nextUrl.searchParams.get("keyword") ?? "ピカチュウ";
  const url     = buildServerClosedSearchUrl(keyword);

  let httpStatus   = 0;
  let htmlLength   = 0;
  let parsedCount  = 0;
  let items: unknown[] = [];
  let fetchError   = "";
  let nextData: unknown = null;
  let nextDataKeys = "";

  try {
    const res  = await fetch(url, { headers: FETCH_HEADERS, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    httpStatus  = res.status;
    const html  = await res.text();
    htmlLength  = html.length;

    // __NEXT_DATA__ を抽出
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (m) {
      try {
        nextData     = JSON.parse(m[1]);
        // トップレベルキーを返す（構造把握用）
        nextDataKeys = JSON.stringify(deepKeys(nextData, 4), null, 2).slice(0, 5000);
      } catch {
        nextDataKeys = m[1].slice(0, 1000);
      }
    }

    items        = parseClosedAuctionHtml(html, 5);
    parsedCount  = items.length;
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    ok: true,
    keyword,
    fetchUrl:    url,
    httpStatus,
    htmlLength,
    parsedCount,
    items,
    nextDataKeys,  // ← これで JSON 構造が分かる
    fetchError:  fetchError || null,
  });
}

/** オブジェクトのキー構造を depth 段階まで取得 */
function deepKeys(obj: unknown, depth: number): unknown {
  if (depth <= 0 || typeof obj !== "object" || obj === null) return typeof obj;
  if (Array.isArray(obj)) {
    return obj.length > 0 ? [`[${obj.length}]`, deepKeys(obj[0], depth - 1)] : [];
  }
  return Object.fromEntries(
    Object.keys(obj as Record<string, unknown>).slice(0, 20).map((k) => [
      k,
      deepKeys((obj as Record<string, unknown>)[k], depth - 1),
    ])
  );
}
