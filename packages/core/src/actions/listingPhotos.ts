/**
 * getCardListingPhotos — カードページ用「実際の出品写真」取得
 *
 * B案（2026-07-08）: 公式カードアートのライセンスが取れるまでの暫定として、
 * 収集済みのマーケット出品データが持つ imageUrl（＝出品者の商品写真）を
 * カードページに表示するためのヘルパー。
 *
 * 方針:
 *  - 画像は「ホットリンク（表示のみ）」前提。再ホスト・キャッシュはしない。
 *  - 承認済み（approved / auto_approved）かつ matchScore >= 80 のみ表示。
 *  - imageUrl が無いものは除外。URL で重複排除し、新しい順に最大 limit 件。
 *
 * 対象ソースと除外の根拠（2026-07-08 実データ調査）:
 *   - Mercari 拡張(RawMarketListing) … 運用者が対象カードを手動選択するため
 *     imageUrl は必ずそのカードの写真。matchScore 80〜100。★主力ソース
 *   - eBay(EbayListing) … alias / cardNumber でマッチし matchScore も高い。
 *   - 旧 RawListing … 現状ほぼ空。Mercari 系のみ残る想定で温存。
 *   - ヤフオク落札(RawAuctionResult)は【除外】。理由が2つ:
 *       (1) 「セット＋レアリティ」だけの緩いマッチで matchScore=75 の別カード
 *          写真が混入する（例: Mewtwo ex にフーディン/リザードン等が付いた）。
 *       (2) 失効した出品画像を Yahoo CDN が HTTP 200 で「画像なし」プレース
 *          ホルダ(na_170x170.png)として返すため、<img> の onError で検知でき
 *          ず、ダサい灰色画像が残ってしまう。
 *
 * matchScore 閾値: カード名まで一致しているとみなす下限を 80 とする
 *   （手動選択の Mercari は 80〜100、緩いマッチは 75 以下で落ちる）。
 *
 * 画像 URL は各マーケットプレイスの CDN を指すため、時間経過で失効し得る。
 * 失効の扱いは表示側（ListingPhotoStrip）の onError に委ねる（DB は触らない）。
 */

import { prisma } from "@gci/db";

export type ListingPhoto = {
  imageUrl:   string;
  source:     string;        // "mercari_sold" | "yahoo_auction_closed" | "ebay" | ...
  listingUrl: string | null; // 出品ページ（あれば）
  price:      number;
  currency:   string;
  capturedAt: string;        // ISO8601
};

/** 承認済みとみなすステータス */
const APPROVED = ["approved", "auto_approved"];

/** カード名まで一致しているとみなす matchScore の下限（根拠はファイル冒頭コメント） */
const MIN_MATCH_SCORE = 80;

export async function getCardListingPhotos(
  cardId: string,
  limit = 6,
): Promise<ListingPhoto[]> {
  const [market, listings, ebay] = await Promise.all([
    // 新統合テーブル（Mercari 拡張の保存先）★主力
    prisma.rawMarketListing.findMany({
      where:   { cardId, status: { in: APPROVED }, imageUrl: { not: null }, matchScore: { gte: MIN_MATCH_SCORE } },
      orderBy: { capturedAt: "desc" },
      take:    limit,
      select:  { imageUrl: true, source: true, url: true, price: true, capturedAt: true },
    }),
    // 旧 Mercari / ヤフオク（現状ほぼ空）
    prisma.rawListing.findMany({
      where:   { cardId, status: { in: APPROVED }, imageUrl: { not: null }, matchScore: { gte: MIN_MATCH_SCORE } },
      orderBy: { capturedAt: "desc" },
      take:    limit,
      select:  { imageUrl: true, source: true, url: true, price: true, capturedAt: true },
    }),
    // eBay（imported も承認済み扱い）
    prisma.ebayListing.findMany({
      where:   { cardId, status: { in: [...APPROVED, "imported"] }, imageUrl: { not: null }, matchScore: { gte: MIN_MATCH_SCORE } },
      orderBy: { createdAt: "desc" },
      take:    limit,
      select:  { imageUrl: true, source: true, listingUrl: true, price: true, currency: true, createdAt: true },
    }),
    // 注: ヤフオク落札(RawAuctionResult)は誤マッチ＋失効プレースホルダ問題のため除外
  ]);

  const rows: ListingPhoto[] = [
    ...market.map((r) => ({
      imageUrl:   r.imageUrl!,
      source:     r.source,
      listingUrl: r.url ?? null,
      price:      r.price,
      currency:   "JPY",
      capturedAt: r.capturedAt.toISOString(),
    })),
    ...listings.map((r) => ({
      imageUrl:   r.imageUrl!,
      source:     r.source,
      listingUrl: r.url ?? null,
      price:      r.price,
      currency:   "JPY",
      capturedAt: r.capturedAt.toISOString(),
    })),
    ...ebay.map((r) => ({
      imageUrl:   r.imageUrl!,
      source:     r.source,
      listingUrl: r.listingUrl ?? null,
      price:      r.price,
      currency:   r.currency ?? "USD",
      capturedAt: r.createdAt.toISOString(),
    })),
  ];

  // 新しい順に整列 → URL で重複排除 → limit 件
  const seen = new Set<string>();
  return rows
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    .filter((r) => {
      if (seen.has(r.imageUrl)) return false;
      seen.add(r.imageUrl);
      return true;
    })
    .slice(0, limit);
}

/**
 * getCardThumbnails — 複数カードの代表サムネイル URL を一括取得
 *
 * ホームページのマーケットムーバー等、多数のカードを一覧するときの
 * サムネ表示用。getCardListingPhotos と同じ信頼できるソース
 * （Mercari 手動選択 + eBay、matchScore >= 80）から、カードごとに
 * 最新の1枚だけを返す。N+1 を避けるため distinct で一括取得する。
 *
 * @returns cardId -> imageUrl のマップ（写真が無いカードはキーごと欠落）
 */
export async function getCardThumbnails(
  cardIds: string[],
): Promise<Record<string, string>> {
  const ids = Array.from(new Set(cardIds)).filter(Boolean);
  if (ids.length === 0) return {};

  const [market, listings, ebay] = await Promise.all([
    prisma.rawMarketListing.findMany({
      where:    { cardId: { in: ids }, status: { in: APPROVED }, imageUrl: { not: null }, matchScore: { gte: MIN_MATCH_SCORE } },
      orderBy:  [{ cardId: "asc" }, { capturedAt: "desc" }],
      distinct: ["cardId"],
      select:   { cardId: true, imageUrl: true },
    }),
    prisma.rawListing.findMany({
      where:    { cardId: { in: ids }, status: { in: APPROVED }, imageUrl: { not: null }, matchScore: { gte: MIN_MATCH_SCORE } },
      orderBy:  [{ cardId: "asc" }, { capturedAt: "desc" }],
      distinct: ["cardId"],
      select:   { cardId: true, imageUrl: true },
    }),
    prisma.ebayListing.findMany({
      where:    { cardId: { in: ids }, status: { in: [...APPROVED, "imported"] }, imageUrl: { not: null }, matchScore: { gte: MIN_MATCH_SCORE } },
      orderBy:  [{ cardId: "asc" }, { createdAt: "desc" }],
      distinct: ["cardId"],
      select:   { cardId: true, imageUrl: true },
    }),
  ]);

  // 優先度: Mercari(手動選択) > eBay > 旧 RawListing。先に入れた方を優先。
  const map: Record<string, string> = {};
  for (const r of [...market, ...ebay, ...listings]) {
    if (r.imageUrl && !map[r.cardId]) map[r.cardId] = r.imageUrl;
  }
  return map;
}
