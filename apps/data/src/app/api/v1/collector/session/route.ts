/**
 * POST /api/v1/collector/session
 *
 * Receives a batch of raw collected listings, saves each as a CollectorRun
 * row with status="pending", and returns a sessionId for the review page.
 *
 * Auth: admin referer or Bearer CRON_SECRET
 *
 * Request body (JSON):
 * {
 *   source:    "mercari",
 *   cardName?: "リザードン ex",
 *   setName?:  "SV4a 深緋の仮面",
 *   rarity?:   "SAR",
 *   items: [
 *     {
 *       name:      string,   // raw Mercari listing title
 *       price:     number,
 *       url?:      string,
 *       condition?: string,
 *       cardName?:  string,  // per-item override
 *       set?:       string,
 *       rarity?:    string,
 *     }
 *   ]
 * }
 *
 * Response:
 * { ok: true, sessionId: "...", count: N }
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID }                from "node:crypto";
import { prisma }                    from "@gci/db";
import {
  normalizeTitle,
  timingSafeEqual,
  filterCollectorItem,
} from "@gci/core";

export const dynamic = "force-dynamic";

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const auth   = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RawItem = {
  name?:      string;
  title?:     string;
  price?:     number | string;
  url?:       string;
  condition?: string;
  cardName?:  string;
  set?:       string;
  rarity?:    string;
};

type SessionBody = {
  source?:   string;
  cardName?: string;
  setName?:  string;
  rarity?:   string;
  minPrice?: number;
  maxPrice?: number;
  items:     RawItem[];
};

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: SessionBody;
  try {
    body = await req.json();
    if (!Array.isArray(body.items)) throw new Error("items must be an array");
    if (body.items.length === 0)    throw new Error("items array is empty");
    if (body.items.length > 500)    throw new Error("max 500 items per session");
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "invalid body" },
      { status: 400 },
    );
  }

  const sessionId = `sess_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const source    = body.source ?? "mercari";

  // Build CollectorRun rows
  const rows = body.items.map((item) => {
    const rawTitle = String(item.name ?? item.title ?? "").trim();
    const rawPrice = Number(item.price ?? 0);
    const rawUrl   = item.url ? String(item.url) : null;

    // Per-item overrides fall back to session-level defaults
    const cardName = String(item.cardName ?? body.cardName ?? "").trim() || null;
    const setName  = String(item.set      ?? body.setName  ?? "").trim() || null;
    const rarity   = String(item.rarity   ?? body.rarity   ?? "").trim() || null;
    const condition = item.condition ? String(item.condition).trim() : null;

    const normTitle = rawTitle ? normalizeTitle(rawTitle) : null;

    // Run filter to pre-populate filterReason for review UI
    const filter = rawTitle
      ? filterCollectorItem(rawTitle, rawPrice, {
          minPrice: body.minPrice,
          maxPrice: body.maxPrice,
        })
      : { pass: false, reason: "missing_title" } as const;

    return {
      sessionId,
      source,
      cardName,
      setName,
      rarity,
      condition:       condition ?? (filter.pass ? (filter.condition ?? null) : null),
      status:          "pending" as const,
      rawTitle:        rawTitle || null,
      rawPrice:        Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null,
      rawUrl,
      normalizedTitle: normTitle,
      normalizedPrice: Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null,
      // Pre-populate filterReason so review page can show it immediately.
      // Items with filterReason stay pending — reviewer decides to approve/reject.
      filterReason: filter.pass ? null : filter.reason,
    };
  });

  try {
    await prisma.collectorRun.createMany({ data: rows });
  } catch (err) {
    console.error("[collector/session] DB error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "database error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, sessionId, count: rows.length });
}
