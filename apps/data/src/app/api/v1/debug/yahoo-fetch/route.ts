/**
 * GET /api/v1/debug/yahoo-fetch?keyword=XXX
 *
 * Yahoo closedsearch の __NEXT_DATA__ から search.items を抽出して構造を確認する。
 */

import { NextRequest, NextResponse } from "next/server";
import { buildServerClosedSearchUrl } from "@gci/core";

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

  try {
    const res  = await fetch(url, { headers: FETCH_HEADERS, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    const html = await res.text();

    // __NEXT_DATA__ を抽出
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) {
      return NextResponse.json({ ok: false, error: "no __NEXT_DATA__ found", httpStatus: res.status });
    }

    const data = JSON.parse(m[1]) as Record<string, unknown>;

    // search.items を探す (props.pageProps.initialState or props.initialState)
    const pageState  = getPath(data, ["props", "pageProps", "initialState", "search"]);
    const globalState = getPath(data, ["props", "initialState", "search"]);
    const searchState = pageState ?? globalState;

    const items = getPath(searchState, ["items"]);
    const firstItem = Array.isArray(items) && items.length > 0 ? items[0] : items;

    return NextResponse.json({
      ok:           true,
      keyword,
      httpStatus:   res.status,
      htmlLength:   html.length,
      // search state のトップキー
      searchKeys:   searchState && typeof searchState === "object" ? Object.keys(searchState as object) : null,
      // items の型と件数
      itemsType:    Array.isArray(items) ? `array[${(items as unknown[]).length}]` : typeof items,
      // 最初の1件の全フィールド
      firstItem,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}

function getPath(obj: unknown, keys: string[]): unknown {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}
