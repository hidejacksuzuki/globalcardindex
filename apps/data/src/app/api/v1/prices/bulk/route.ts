/**
 * POST /api/v1/prices/bulk
 *
 * Authenticated JSON bulk price push for programmatic collectors
 * (e.g. Mercari scraper, manual scripts).
 *
 * Auth: Bearer CRON_SECRET  (same secret used by cron endpoints)
 *       Falls back to admin referer check (browser-based callers).
 *
 * Body: application/json — array of BulkPriceItem objects (max 500 items)
 *
 * Query params:
 *   ?dry=1  — validate only, no DB writes
 *
 * Response: ImportSummary
 *   { ok, totalRows, imported, skipped, duplicate, errors[] }
 *
 * Errors at the item level are collected; the request always returns 200
 * unless the entire payload is malformed (400) or auth fails (401).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import {
  clampTrustScore,
  DEFAULT_TRUST,
  attachFingerprint,
  computeTrustScore,
  normalizeListingType,
  timingSafeEqual,
} from "@gci/core";

export const dynamic = "force-dynamic";

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET ?? "";

  // Programmatic: Bearer CRON_SECRET
  const authHeader = req.headers.get("authorization") ?? "";
  if (
    cronSecret.length >= 16 &&
    authHeader.startsWith("Bearer ") &&
    timingSafeEqual(authHeader.slice(7).trim(), cronSecret)
  ) {
    return true;
  }

  // Browser session: referer from admin UI (non-production also allowed)
  const referer = req.headers.get("referer") ?? "";
  if (referer.includes("/admin/") || process.env.NODE_ENV !== "production") {
    return true;
  }

  return false;
}

// ── Payload types ─────────────────────────────────────────────────────────────

/**
 * One price entry in the bulk payload.
 * Mirrors the GCI CSV columns — required fields enforced at runtime.
 */
export type BulkPriceItem = {
  date:         string;   // ISO date / datetime string
  cardName:     string;
  set:          string;
  rarity:       string;
  condition:    string;
  price:        number;
  currency?:    string;
  sourceType?:  string;
  sourceName?:  string;
  url?:         string;
  listingType?: string;
  sellerScore?: number;   // 0–100 (same scale as CSV)
  availability?: string;
  trustScore?:  number;   // 0.0–1.0 manual override
  notes?:       string;
};

type BulkSummary = {
  ok:        boolean;
  totalRows: number;
  imported:  number;
  skipped:   number;
  duplicate: number;
  errors:    { row: number; reason: string }[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ITEMS = 500;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const isDry = new URL(req.url).searchParams.get("dry") === "1";

  // ── Parse body ──────────────────────────────────────────────────────────────
  let items: BulkPriceItem[];
  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, error: "body must be a JSON array of price items" },
        { status: 400 },
      );
    }
    if (body.length > MAX_ITEMS) {
      return NextResponse.json(
        { ok: false, error: `too many items (max ${MAX_ITEMS})` },
        { status: 400 },
      );
    }
    items = body as BulkPriceItem[];
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON body" },
      { status: 400 },
    );
  }

  // ── Process items ────────────────────────────────────────────────────────────
  const summary: BulkSummary = {
    ok:        true,
    totalRows: items.length,
    imported:  0,
    skipped:   0,
    duplicate: 0,
    errors:    [],
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      // ── Validate required fields ──
      const price      = Number(item.price);
      const observedAt = new Date(item.date);

      if (
        !item.cardName?.trim() ||
        !item.set?.trim()      ||
        !item.rarity?.trim()   ||
        !item.condition?.trim() ||
        Number.isNaN(price)    ||
        Number.isNaN(observedAt.getTime())
      ) {
        summary.skipped++;
        summary.errors.push({ row: i + 1, reason: "missing or invalid required field" });
        continue;
      }

      const sourceType = item.sourceType || "unknown";
      const sourceName = item.sourceName || "unknown";
      const url        = item.url        || null;

      // ── Source upsert ──
      const source = isDry
        ? { id: "dry-source", defaultTrustScore: DEFAULT_TRUST, trustWeight: 1.0 }
        : await prisma.source.upsert({
            where:  { name: sourceName },
            create: { name: sourceName, type: sourceType, defaultTrustScore: DEFAULT_TRUST },
            update: { type: sourceType },
          });

      // ── Card upsert ──
      const card = isDry
        ? { id: "dry-card" }
        : await prisma.card.upsert({
            where: {
              name_setName_rarity_condition: {
                name:      item.cardName,
                setName:   item.set,
                rarity:    item.rarity,
                condition: item.condition,
              },
            },
            create: {
              name:      item.cardName,
              setName:   item.set,
              rarity:    item.rarity,
              condition: item.condition,
            },
            update: {},
          });

      // ── Listing type ──
      const rawListingType = item.listingType || null;
      const listingType    = rawListingType
        ? normalizeListingType(rawListingType)
        : "unknown";

      // ── Seller score (0–100 → 0.0–1.0) ──
      const sellerScore =
        item.sellerScore != null
          ? Math.min(1.0, Math.max(0.0, item.sellerScore / 100))
          : null;

      // ── Fingerprint & urlHash ──
      const enriched = attachFingerprint({
        cardId:     card.id,
        price,
        observedAt,
        url,
        sourceName,
      });

      // ── Trust score ──
      const manualScore =
        item.trustScore != null ? clampTrustScore(item.trustScore) : null;

      const trustScore = manualScore ?? computeTrustScore({
        sourceDefaultScore: source.defaultTrustScore,
        sourceTrustWeight:  source.trustWeight,
        sellerScore,
        listingType,
      });

      // ── Duplicate URL guard ──
      // The fingerprint @unique already catches exact price+date+url duplicates.
      // This check catches the case where the same listing URL was imported before
      // at any price (e.g. re-scraped after a price edit on Mercari).
      if (!isDry && enriched.urlHash) {
        const existingByUrl = await prisma.price.findFirst({
          where:  { urlHash: enriched.urlHash },
          select: { id: true },
        });
        if (existingByUrl) {
          summary.duplicate++;
          summary.errors.push({ row: i + 1, reason: `duplicate_url: urlHash already exists` });
          continue;
        }
      }

      // ── Insert ──
      if (isDry) {
        summary.imported++;
      } else {
        const result = await prisma.price.createMany({
          data: [{
            cardId:         card.id,
            price,
            currency:       item.currency || "JPY",
            sourceType,
            sourceName,
            sourceId:       source.id,
            observedAt,
            listingType,
            rawListingType,
            sellerScore,
            availability:   item.availability || null,
            fingerprint:    enriched.fingerprint,
            urlHash:        enriched.urlHash,
            trustScore,
            notes:          item.notes || null,
          }],
          skipDuplicates: true,
        });

        if (result.count === 0) {
          summary.duplicate++;
        } else {
          summary.imported++;
        }
      }

    } catch (err) {
      summary.skipped++;
      summary.errors.push({
        row:    i + 1,
        reason: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return NextResponse.json(summary);
}
