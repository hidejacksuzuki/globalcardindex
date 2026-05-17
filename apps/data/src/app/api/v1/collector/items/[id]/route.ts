/**
 * PATCH /api/v1/collector/items/[id]
 *
 * Per-item review action for CollectorRun records.
 *
 * Auth: admin referer or Bearer CRON_SECRET
 *
 * Request body:
 * {
 *   action: "approve" | "reject" | "edit",
 *   edits?: {
 *     normalizedTitle?: string,
 *     normalizedPrice?: number,
 *     condition?:       string,
 *     rawUrl?:          string,
 *     cardName?:        string,
 *     setName?:         string,
 *     rarity?:          string,
 *   },
 *   rejectReason?: string,
 * }
 *
 * approve:
 *   – Applies any pending edits to the record fields
 *   – Posts a single item to /api/v1/prices/bulk (internal call)
 *   – On success: status="imported", importedAt=now
 *   – On bulk error: status stays "pending", returns error
 *
 * reject:
 *   – status="filtered", filterReason=rejectReason
 *
 * edit:
 *   – Merges edits into the record, status stays "pending"
 *
 * Response: { ok: true, run: CollectorRun } | { ok: false, error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual }           from "@gci/core";

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

type PatchBody = {
  action:        "approve" | "reject" | "edit";
  edits?: {
    normalizedTitle?: string;
    normalizedPrice?: number;
    condition?:       string;
    rawUrl?:          string;
    cardName?:        string;
    setName?:         string;
    rarity?:          string;
  };
  rejectReason?: string;
};

// ── Internal bulk call ────────────────────────────────────────────────────────

async function submitToBulk(
  run: {
    cardName?:        string | null;
    setName?:         string | null;
    rarity?:          string | null;
    condition?:       string | null;
    normalizedPrice?: number | null;
    rawPrice?:        number | null;
    source:           string;
    rawUrl?:          string | null;
    normalizedTitle?: string | null;
    rawTitle?:        string | null;
  },
  req: NextRequest,
): Promise<{ ok: boolean; error?: string; imported?: number; duplicate?: number }> {
  const price = run.normalizedPrice ?? run.rawPrice;
  if (!price) return { ok: false, error: "no price" };

  const payload = [{
    date:       new Date().toISOString().slice(0, 10),
    cardName:   run.cardName   ?? run.normalizedTitle ?? run.rawTitle ?? "unknown",
    set:        run.setName    ?? "unknown",
    rarity:     run.rarity     ?? "unknown",
    condition:  run.condition  ?? "unknown",
    price,
    currency:   "JPY",
    sourceType: "marketplace",
    sourceName: run.source,
    url:        run.rawUrl     ?? undefined,
    listingType:"buy_now",
    notes:      `collector-review: ${(run.rawTitle ?? "").slice(0, 80)}`,
  }];

  // Internal fetch — construct URL from request
  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const res = await fetch(`${baseUrl}/api/v1/prices/bulk`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.CRON_SECRET ?? ""}`,
      "Referer":       `${baseUrl}/admin/`,
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function PATCH(
  req:     NextRequest,
  context: { params: { id: string } },
): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = context.params;

  // Load current run
  const run = await prisma.collectorRun.findUnique({ where: { id } });
  if (!run) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
    if (!["approve", "reject", "edit"].includes(body.action)) {
      throw new Error(`unknown action: ${body.action}`);
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "invalid body" },
      { status: 400 },
    );
  }

  // Apply edits to a working copy
  const edits   = body.edits ?? {};
  const updated = {
    ...run,
    normalizedTitle: edits.normalizedTitle ?? run.normalizedTitle,
    normalizedPrice: edits.normalizedPrice ?? run.normalizedPrice,
    condition:       edits.condition       ?? run.condition,
    rawUrl:          edits.rawUrl          ?? run.rawUrl,
    cardName:        edits.cardName        ?? run.cardName,
    setName:         edits.setName         ?? run.setName,
    rarity:          edits.rarity          ?? run.rarity,
  };

  if (body.action === "edit") {
    // Persist edits, keep status=pending
    const saved = await prisma.collectorRun.update({
      where: { id },
      data:  {
        normalizedTitle: updated.normalizedTitle,
        normalizedPrice: updated.normalizedPrice,
        condition:       updated.condition,
        rawUrl:          updated.rawUrl,
        cardName:        updated.cardName,
        setName:         updated.setName,
        rarity:          updated.rarity,
      },
    });
    return NextResponse.json({ ok: true, run: saved });
  }

  if (body.action === "reject") {
    const saved = await prisma.collectorRun.update({
      where: { id },
      data:  {
        status:       "filtered",
        filterReason: body.rejectReason ?? "manual_reject",
      },
    });
    return NextResponse.json({ ok: true, run: saved });
  }

  // action === "approve"
  const bulkResult = await submitToBulk(updated, req);

  if (!bulkResult.ok) {
    return NextResponse.json(
      { ok: false, error: bulkResult.error ?? "bulk import failed" },
      { status: 502 },
    );
  }

  const status = bulkResult.duplicate && bulkResult.duplicate > 0 ? "duplicate" : "imported";

  const saved = await prisma.collectorRun.update({
    where: { id },
    data:  {
      // Persist any applied edits
      normalizedTitle: updated.normalizedTitle,
      normalizedPrice: updated.normalizedPrice,
      condition:       updated.condition,
      rawUrl:          updated.rawUrl,
      cardName:        updated.cardName,
      setName:         updated.setName,
      rarity:          updated.rarity,
      // Update status
      status,
      importedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, run: saved, bulkResult });
}
