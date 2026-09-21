/**
 * POST /api/v1/import/market-results/auto
 *
 * セット一括インポート — cardId を指定せず、各アイテムをタイトル照合で
 * 該当カードに自動振り分けする（メルカリ拡張の「セット一括」モード用）。
 *
 * 仕組み:
 *   1. 可視カード全件を1回ロードし、タイトルにカード名が含まれる候補だけに絞る
 *   2. 候補ごとに scoreMarketListing（単カード取込と同じ採点）を実行し最良カードを選ぶ
 *   3. matchScore が承認水準に届いたものだけ RawMarketListing + Price として保存
 *      （どのカードとも照合できないアイテムは保存せず unmatched として返す）
 *
 * Body:   { source, items: [{title, price, url?, imageUrl?, endedAt?}] }
 * Response: { ok, saved, autoApproved, pending, unmatched, skipped, perCard: [...] }
 */

import { NextRequest, NextResponse }           from "next/server";
import { prisma }                              from "@gci/db";
import { timingSafeEqual, scoreMarketListing } from "@gci/core";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const auth   = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  return process.env.NODE_ENV !== "production";
}

const VALID_SOURCES = ["mercari_sold", "mercari_listing"];

type Item = {
  title:     string;
  price:     number;
  url?:      string;
  imageUrl?: string;
  endedAt?:  string;
};

/** 候補絞り込み用の緩い正規化（記号除去・小文字化）。採点は scoreMarketListing が行う */
function looseNorm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9぀-ヿ㐀-鿿０-９ａ-ｚ]/g, "");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const body = await req.json() as { source?: string; items?: Item[] };
  if (!body.source || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ ok: false, error: "source, items[] required" }, { status: 400, headers: CORS_HEADERS });
  }
  if (!VALID_SOURCES.includes(body.source)) {
    return NextResponse.json(
      { ok: false, error: `source must be one of: ${VALID_SOURCES.join(", ")}` },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  const source = body.source;

  // 全可視カード（照合候補）を1回だけロード
  const cards = await prisma.card.findMany({
    where:  { deletedAt: null, isVisible: true },
    select: { id: true, name: true, rarity: true, setName: true, condition: true },
  });
  const cardsNorm = cards.map((c) => ({ card: c, normName: looseNorm(c.name) }))
    .filter((c) => c.normName.length >= 2);

  // カードごとの中央値キャッシュ（trustScore 用）
  const medianCache = new Map<string, number | null>();
  async function medianFor(cardId: string): Promise<number | null> {
    if (medianCache.has(cardId)) return medianCache.get(cardId)!;
    const existing = await prisma.rawMarketListing.findMany({
      where:   { cardId, source, status: { in: ["approved", "auto_approved"] } },
      select:  { price: true },
      orderBy: { capturedAt: "desc" },
      take:    50,
    });
    const ps = existing.map((e) => e.price).sort((a, b) => a - b);
    const med = ps.length > 0 ? ps[Math.floor(ps.length / 2)] : null;
    medianCache.set(cardId, med);
    return med;
  }

  let saved = 0, autoApproved = 0, pending = 0, unmatched = 0, skipped = 0;
  const perCard = new Map<string, { name: string; setName: string; rarity: string; condition: string; saved: number; autoApproved: number }>();

  for (const item of body.items.slice(0, 300)) {
    if (!item.title || item.price == null) { skipped++; continue; }

    // URL 重複はカード横断でチェック（同じ出品を別カードに二重登録しない）
    if (item.url) {
      const dup = await prisma.rawMarketListing.findFirst({
        where: { url: item.url }, select: { id: true },
      });
      if (dup) { skipped++; continue; }
    }

    // 1. 名前が含まれるカードだけに候補を絞る
    const normTitle = looseNorm(item.title);
    const candidates = cardsNorm.filter((c) => normTitle.includes(c.normName));
    if (candidates.length === 0) { unmatched++; continue; }

    // 2. 候補を採点して最良カードを選ぶ（median なしの素点で比較）
    let best: { card: (typeof cards)[number]; matchScore: number } | null = null;
    for (const c of candidates) {
      const { matchScore } = scoreMarketListing(
        { title: item.title, price: item.price, source, url: item.url },
        { name: c.card.name, rarity: c.card.rarity, setName: c.card.setName, condition: c.card.condition },
        null,
      );
      if (!best || matchScore > best.matchScore) best = { card: c.card, matchScore };
    }
    if (!best) { unmatched++; continue; }

    // 3. 最良カードで median 込みの本採点 → 承認水準に届かなければ保存しない
    const median = await medianFor(best.card.id);
    const { matchScore, trustScore, status } = scoreMarketListing(
      { title: item.title, price: item.price, source, url: item.url },
      { name: best.card.name, rarity: best.card.rarity, setName: best.card.setName, condition: best.card.condition },
      median,
    );
    if (status !== "auto_approved" && status !== "pending") { unmatched++; continue; }

    try {
      await prisma.rawMarketListing.create({
        data: {
          cardId:   best.card.id,
          source,
          title:    item.title,
          price:    Math.round(item.price),
          url:      item.url      ?? null,
          imageUrl: item.imageUrl ?? null,
          endedAt:  item.endedAt ? new Date(item.endedAt) : null,
          matchScore,
          trustScore,
          status,
        },
      });

      if (status === "auto_approved") {
        await prisma.price.create({
          data: {
            cardId:      best.card.id,
            price:       Math.round(item.price),
            observedAt:  item.endedAt ? new Date(item.endedAt) : new Date(),
            sourceType:  source,
            sourceName:  source,
            fingerprint: `rml:${item.url ?? `${best.card.id}:${item.title.slice(0, 30)}:${item.price}`}`,
            trustScore,
          },
        }).catch(() => undefined);
        autoApproved++;
      } else {
        pending++;
      }
      saved++;

      const key = best.card.id;
      const agg = perCard.get(key) ?? {
        name: best.card.name, setName: best.card.setName,
        rarity: best.card.rarity, condition: best.card.condition,
        saved: 0, autoApproved: 0,
      };
      agg.saved++;
      if (status === "auto_approved") agg.autoApproved++;
      perCard.set(key, agg);
    } catch {
      skipped++;
    }
  }

  return NextResponse.json(
    {
      ok: true, saved, autoApproved, pending, unmatched, skipped,
      perCard: [...perCard.entries()]
        .map(([cardId, v]) => ({ cardId, ...v }))
        .sort((a, b) => b.saved - a.saved),
    },
    { headers: CORS_HEADERS },
  );
}
