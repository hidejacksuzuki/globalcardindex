/**
 * POST /api/admin/collector/ebay/extension-import
 *
 * Chrome拡張から送信されたeBay Sold検索結果を受信し、
 * EbayListing として保存する。
 *
 * Auto-import条件（全て満たす場合のみ自動でPriceに変換）:
 *   1. matchScore >= 90
 *   2. cardNumber が alias に設定されており、title に完全一致
 *   3. language が alias に設定されており、title に一致
 *   4. negativeKeywords がタイトルに含まれない
 *   5. 価格が過去中央値の ±35% 以内（サンプル3件以上の場合のみ）
 *
 * Auth: X-GCI-Key ヘッダーまたは Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import {
  calculateEbayMatchScore,
  convertToJpy,
  convertToUsd,
} from "@gci/core";

export const dynamic = "force-dynamic";

const EBAY_SOLD_BASE_TRUST = 90;

// ── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 8) return process.env.NODE_ENV !== "production";

  const auth   = req.headers.get("authorization") ?? "";
  const gciKey = req.headers.get("x-gci-key")     ?? "";

  if (auth.startsWith("Bearer ") && auth.slice(7).trim() === secret) return true;
  if (gciKey === secret) return true;

  const origin = req.headers.get("origin") ?? "";
  return origin.includes("localhost") || process.env.NODE_ENV !== "production";
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ExtensionListing = {
  title:      string;
  price:      number;
  shipping:   number;
  totalPrice: number;
  currency:   string;
  soldAt:     string | null;   // ISO8601
  listingUrl: string | null;
  imageUrl:   string | null;
};

type RequestBody = {
  cardAliasId: string;
  listings:    ExtensionListing[];
};

// ── Median helper ─────────────────────────────────────────────────────────────

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // CORS — Chrome拡張からのリクエストを許可
  const corsHeaders = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-GCI-Key",
  };

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: corsHeaders });
  }

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400, headers: corsHeaders });
  }

  if (!body.cardAliasId || !Array.isArray(body.listings) || body.listings.length === 0) {
    return NextResponse.json(
      { ok: false, error: "cardAliasId and listings[] are required" },
      { status: 400, headers: corsHeaders },
    );
  }

  const alias = await prisma.cardAlias.findUnique({
    where:   { id: body.cardAliasId },
    include: { card: true },
  });
  if (!alias) {
    return NextResponse.json({ ok: false, error: "CardAlias not found" }, { status: 404, headers: corsHeaders });
  }

  // 既存の imported EbayListing から価格中央値を算出（USD）
  const existingImported = await prisma.ebayListing.findMany({
    where:  { cardId: alias.cardId, status: "imported", priceUsd: { not: null } },
    select: { priceUsd: true },
    take:   100,
  });
  const existingUsdPrices = existingImported
    .map((l) => l.priceUsd)
    .filter((p): p is number => p !== null);
  const priceMedianUsd = existingUsdPrices.length >= 3 ? median(existingUsdPrices) : null;

  const negKwList = alias.negativeKeywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  let savedCount      = 0;
  let autoImportCount = 0;
  const results: Array<{ title: string; status: string; matchScore: number; autoImported: boolean }> = [];

  for (const raw of body.listings) {
    const { score, reasons } = calculateEbayMatchScore({
      title:            raw.title,
      name:             alias.name,
      setName:          alias.setName,
      cardNumber:       alias.cardNumber,
      rarity:           alias.rarity,
      language:         alias.language,
      negativeKeywords: alias.negativeKeywords,
      hasSoldAt:        !!raw.soldAt,
    });

    const totalPrice = raw.totalPrice > 0 ? raw.totalPrice : raw.price + raw.shipping;
    const priceJpy   = convertToJpy(totalPrice, raw.currency);
    const priceUsd   = convertToUsd(totalPrice, raw.currency);

    // ── Auto-import 判定 ─────────────────────────────────────────────────────

    const titleLower = raw.title.toLowerCase();

    const hasNegKw = negKwList.some((kw) => titleLower.includes(kw));

    const cardNumberMatch =
      !alias.cardNumber ||
      titleLower.includes(alias.cardNumber.trim().toLowerCase());

    const languageMatch =
      !alias.language ||
      titleLower.includes(alias.language.trim().toLowerCase());

    const withinPriceRange =
      priceMedianUsd === null ||
      priceUsd === null ||
      (priceUsd >= priceMedianUsd * 0.65 && priceUsd <= priceMedianUsd * 1.35);

    const shouldAutoImport =
      score >= 90 &&
      cardNumberMatch &&
      languageMatch &&
      !hasNegKw &&
      withinPriceRange;

    const status: string = shouldAutoImport ? "imported" : "pending";

    // 重複チェック: 同じ listingUrl がすでにあればスキップ
    if (raw.listingUrl) {
      const existing = await prisma.ebayListing.findFirst({
        where: { cardId: alias.cardId, listingUrl: raw.listingUrl },
        select: { id: true },
      });
      if (existing) {
        results.push({ title: raw.title, status: "duplicate", matchScore: score, autoImported: false });
        continue;
      }
    }

    const saved = await prisma.ebayListing.create({
      data: {
        cardId:       alias.cardId,
        cardAliasId:  alias.id,
        source:       "ebay",
        market:       alias.market as string,
        title:        raw.title,
        price:        raw.price,
        currency:     raw.currency,
        shippingPrice: raw.shipping,
        totalPrice,
        soldAt:       raw.soldAt ? new Date(raw.soldAt) : null,
        listingUrl:   raw.listingUrl,
        imageUrl:     raw.imageUrl,
        listingType:  "sold",
        matchScore:   score,
        status,
        priceJpy:     priceJpy ?? undefined,
        priceUsd:     priceUsd ?? undefined,
        rawJson:      { reasons } as object,
      },
    });
    savedCount++;

    if (shouldAutoImport) {
      // Price レコードを直接作成
      const trustBonus = Math.round((score / 100) * 10);
      const trustScore = Math.min(100, EBAY_SOLD_BASE_TRUST + trustBonus);
      const price      = priceJpy ?? totalPrice;
      const currency   = priceJpy ? "JPY" : raw.currency;
      const fingerprint = `ebay:${raw.listingUrl ?? saved.id}`;

      await prisma.price.create({
        data: {
          cardId:       alias.cardId,
          price,
          currency,
          observedAt:   raw.soldAt ? new Date(raw.soldAt) : saved.createdAt,
          sourceType:   "ebay",
          sourceName:   "ebay",
          listingType:  "fixed",
          availability: "sold",
          fingerprint,
          urlHash:      raw.listingUrl
            ? Buffer.from(raw.listingUrl).toString("base64").slice(0, 64)
            : null,
          trustScore,
          notes:        `market:${alias.market} currency:${raw.currency} matchScore:${score} source:extension`,
        },
      }).catch((err: { code?: string }) => {
        if (err?.code === "P2002") return null;
        throw err;
      });

      autoImportCount++;
    }

    results.push({ title: raw.title, status, matchScore: score, autoImported: shouldAutoImport });
  }

  return NextResponse.json(
    {
      ok:             true,
      saved:          savedCount,
      autoImported:   autoImportCount,
      pending:        savedCount - autoImportCount,
      priceMedianUsd,
      results,
    },
    { headers: corsHeaders },
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-GCI-Key",
    },
  });
}
