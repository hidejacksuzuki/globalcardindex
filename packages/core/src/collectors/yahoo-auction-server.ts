/**
 * yahoo-auction-server.ts
 *
 * サーバーサイドで Yahoo オークション落札ページをフェッチ・解析して
 * 落札データを返す。Chrome 拡張不要。
 *
 * 注意:
 *   - Yahoo Auction の HTML 構造変更に伴い適宜パターンを更新すること
 *   - rate limit: 呼び出し元で 2 秒以上の間隔を空けること
 *   - robots.txt: closedsearch は Disallow に含まれていないため合法的に取得可能
 */

export type ServerAuctionItem = {
  title:    string;
  price:    number;
  url:      string;
  endedAt?: string;   // ISO string
  bidCount?: number;
};

// ── URL Builder ───────────────────────────────────────────────────────────────

export function buildServerClosedSearchUrl(keyword: string, page = 1): string {
  const params = new URLSearchParams({
    p:        keyword,
    va:       keyword,
    auctype:  "2",      // 落札済み
    b:        String((page - 1) * 20 + 1),
    n:        "20",
  });
  return `https://auctions.yahoo.co.jp/closedsearch/closedsearch?${params.toString()}`;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

const FETCH_HEADERS = {
  "User-Agent":       "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language":  "ja-JP,ja;q=0.9",
  "Accept":           "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Cache-Control":    "no-cache",
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
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  return parseClosedAuctionHtml(html, maxItems);
}

// ── HTML Parser ────────────────────────────────────────────────────────────────

/**
 * Yahoo オークション落札検索ページの HTML から落札データを抽出する。
 *
 * 対応パターン（HTML 構造が複数ある）:
 *   1. `<a href="https://auctions.yahoo.co.jp/jp/auction/XXXXXX">` 形式
 *   2. `data-auction-id="XXXXXX"` 形式
 *
 * 価格は各アイテムのコンテナ内に含まれる数字から抽出。
 */
export function parseClosedAuctionHtml(html: string, maxItems = 20): ServerAuctionItem[] {
  const items: ServerAuctionItem[] = [];
  const seen  = new Set<string>();

  // ── パターン A: <li class="Product"> 形式 ──
  // 各 <li class="...Product..."> ブロックを切り出す
  const liPattern = /<li[^>]*class="[^"]*Product[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch: RegExpExecArray | null;

  while ((liMatch = liPattern.exec(html)) !== null && items.length < maxItems) {
    const block = liMatch[1];
    const item  = extractFromBlock(block);
    if (item && !seen.has(item.url)) {
      seen.add(item.url);
      items.push(item);
    }
  }

  // ── パターン B: div ベースのレイアウト ──
  if (items.length === 0) {
    const divPattern = /<div[^>]*class="[^"]*(?:item|product|auction)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>)?/gi;
    let divMatch: RegExpExecArray | null;
    while ((divMatch = divPattern.exec(html)) !== null && items.length < maxItems) {
      const block = divMatch[1];
      const item  = extractFromBlock(block);
      if (item && !seen.has(item.url)) {
        seen.add(item.url);
        items.push(item);
      }
    }
  }

  // ── パターン C: オークション URL を anchor タグから直接抽出 ──
  if (items.length === 0) {
    items.push(...extractFromAnchors(html, maxItems));
  }

  return items;
}

/** ブロック HTML から1件分のデータを抽出 */
function extractFromBlock(block: string): ServerAuctionItem | null {
  // URL 取得: auctions.yahoo.co.jp/jp/auction/XXXXX
  const urlMatch = block.match(/href="(https:\/\/(?:page\.)?auctions\.yahoo\.co\.jp\/jp\/auction\/[^"?#]+)"/i);
  if (!urlMatch) return null;
  const url = urlMatch[1];

  // タイトル取得: <a> タグテキスト or alt 属性
  const titleFromA = block.match(/<a[^>]+href="[^"]*auctions\.yahoo\.co\.jp\/jp\/auction[^"]*"[^>]*>([^<]{4,})<\/a>/i);
  const titleFromAlt = block.match(/alt="([^"]{4,})"/i);
  const title = (titleFromA?.[1] ?? titleFromAlt?.[1] ?? "").replace(/\s+/g, " ").trim();
  if (title.length < 4) return null;

  // 価格取得: 落札価格を優先
  const priceFromRakusatsu = block.match(/落札[^¥￥\d]*([\d,]+)円/);
  const priceFromAll       = block.match(/([\d,]{3,10})円/g);
  let price = 0;

  if (priceFromRakusatsu) {
    price = parseInt(priceFromRakusatsu[1].replace(/,/g, ""), 10);
  } else if (priceFromAll) {
    const nums = priceFromAll
      .map((s) => parseInt(s.replace(/[,円]/g, ""), 10))
      .filter((n) => n >= 100 && n <= 10_000_000);
    if (nums.length) price = Math.max(...nums);
  }

  if (price < 100) return null;

  // 入札数
  const bidMatch = block.match(/(\d+)\s*(?:件|入札)/);
  const bidCount = bidMatch ? parseInt(bidMatch[1], 10) : undefined;

  // 落札日時
  const dateMatch = block.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
  const endedAt   = dateMatch
    ? new Date(`${dateMatch[1]}-${dateMatch[2].padStart(2,"0")}-${dateMatch[3].padStart(2,"0")}`).toISOString()
    : undefined;

  return { title, price, url, bidCount, endedAt };
}

/** フォールバック: ページ全体の anchor タグからオークションデータを取得 */
function extractFromAnchors(html: string, maxItems: number): ServerAuctionItem[] {
  const items: ServerAuctionItem[] = [];
  const seen  = new Set<string>();

  // aタグを抽出してURLとテキストを取る
  const anchorPattern = /<a[^>]+href="(https:\/\/(?:page\.)?auctions\.yahoo\.co\.jp\/jp\/auction\/([^"?#]+))"[^>]*>([^<]*)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = anchorPattern.exec(html)) !== null && items.length < maxItems) {
    const [, url, , rawTitle] = m;
    const title = rawTitle.replace(/\s+/g, " ").trim();
    if (title.length < 4 || /^[\d,¥￥\s]+$/.test(title)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    // URL 近傍 200 文字の価格を探す
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
