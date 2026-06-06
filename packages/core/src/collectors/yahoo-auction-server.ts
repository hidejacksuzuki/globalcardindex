/**
 * yahoo-auction-server.ts
 *
 * サーバーサイドで Yahoo オークション落札ページをフェッチ・解析して
 * 落札データを返す。Chrome 拡張不要。
 *
 * Yahoo は Next.js SSR に移行済みのため、
 * __NEXT_DATA__ JSON から直接データを取得する。
 *
 * パス: props.pageProps.initialState.search.items.listing.items[]
 */

export type ServerAuctionItem = {
  title:     string;
  price:     number;
  url:       string;
  imageUrl?: string;
  endedAt?:  string;   // ISO string
  bidCount?: number;
};

// ── URL Builder ───────────────────────────────────────────────────────────────

export function buildServerClosedSearchUrl(keyword: string, page = 1): string {
  const params = new URLSearchParams({
    p:       keyword,
    va:      keyword,
    auctype: "2",      // 落札済み
    b:       String((page - 1) * 20 + 1),
    n:       "20",
  });
  return `https://auctions.yahoo.co.jp/closedsearch/closedsearch?${params.toString()}`;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

const FETCH_HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "ja-JP,ja;q=0.9",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Cache-Control":   "no-cache",
};

export async function fetchClosedAuctions(
  keyword: string,
  maxItems = 20,
): Promise<ServerAuctionItem[]> {
  const url = buildServerClosedSearchUrl(keyword);

  let html: string;
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  return parseClosedAuctionHtml(html, maxItems);
}

// ── Parser ────────────────────────────────────────────────────────────────────

export function parseClosedAuctionHtml(html: string, maxItems = 20): ServerAuctionItem[] {
  // ── __NEXT_DATA__ JSON から取得（Yahoo が Next.js に移行済み）──
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      const data = JSON.parse(m[1]) as unknown;
      const items = extractFromNextData(data, maxItems);
      if (items.length > 0) return items;
    } catch {
      // JSON parse 失敗 → HTML フォールバックへ
    }
  }

  // ── フォールバック: 旧 HTML パターン ──
  return extractFromHtml(html, maxItems);
}

// ── __NEXT_DATA__ Extractor ───────────────────────────────────────────────────

type YahooItem = {
  auctionId?: string;
  title?:     string;
  price?:     number;
  endTime?:   string;
  bidCount?:  number;
  imageUrl?:  string;
};

function extractFromNextData(data: unknown, maxItems: number): ServerAuctionItem[] {
  // props.pageProps.initialState.search.items.listing.items
  const listingItems = getPath(data, [
    "props", "pageProps", "initialState",
    "search", "items", "listing", "items",
  ]);

  if (!Array.isArray(listingItems) || listingItems.length === 0) return [];

  const result: ServerAuctionItem[] = [];

  for (const raw of listingItems.slice(0, maxItems)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as YahooItem;

    const auctionId = item.auctionId?.trim();
    if (!auctionId) continue;

    const title = item.title?.trim() ?? "";
    if (title.length < 3) continue;

    const price = Number(item.price ?? 0);
    if (price < 100) continue;

    result.push({
      title,
      price,
      url:      `https://page.auctions.yahoo.co.jp/jp/auction/${auctionId}`,
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
      endedAt:  typeof item.endTime  === "string" ? item.endTime  : undefined,
      bidCount: typeof item.bidCount === "number" ? item.bidCount : undefined,
    });
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPath(obj: unknown, keys: string[]): unknown {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

/** フォールバック: 旧 HTML パターンで抽出（構造変更前の互換用） */
function extractFromHtml(html: string, maxItems: number): ServerAuctionItem[] {
  const items: ServerAuctionItem[] = [];
  const seen  = new Set<string>();

  const anchorPattern = /<a[^>]+href="(https:\/\/(?:page\.)?auctions\.yahoo\.co\.jp\/jp\/auction\/([^"?#]+))"[^>]*>([^<]*)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = anchorPattern.exec(html)) !== null && items.length < maxItems) {
    const [, url, , rawTitle] = m;
    const title = rawTitle.replace(/\s+/g, " ").trim();
    if (title.length < 4 || /^[\d,¥￥\s]+$/.test(title)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const idx    = html.indexOf(url);
    const nearby = html.slice(Math.max(0, idx - 100), idx + 300);
    const priceM = nearby.match(/([\d,]{3,10})円/g);
    const nums   = (priceM ?? [])
      .map((s) => parseInt(s.replace(/[,円]/g, ""), 10))
      .filter((n) => n >= 100 && n <= 10_000_000);
    if (!nums.length) continue;

    items.push({ title, price: Math.max(...nums), url });
  }

  return items;
}
