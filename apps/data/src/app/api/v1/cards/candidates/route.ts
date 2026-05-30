/**
 * POST /api/v1/cards/candidates  — 複数行テキストから CardCandidate を一括作成
 * GET  /api/v1/cards/candidates  — CardCandidate 一覧取得
 */

import { NextRequest, NextResponse }         from "next/server";
import { prisma }                            from "@gci/db";
import { timingSafeEqual, parseCardCandidates } from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const auth   = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { lines?: string[] };
  if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ ok: false, error: "lines[] required" }, { status: 400 });
  }

  const parsed = parseCardCandidates(body.lines.slice(0, 200));

  // 既存カードとの重複チェック
  const withMeta = await Promise.all(
    parsed.map(async (c) => {
      const existing = await prisma.card.findFirst({
        where: {
          name:   { contains: c.name, mode: "insensitive" },
          ...(c.rarity ? { rarity: { equals: c.rarity, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true },
      });
      return { ...c, duplicateCard: existing ?? null };
    }),
  );

  // DB 保存
  const created = await prisma.cardCandidate.createMany({
    data: parsed.map((c) => ({
      inputText:    c.inputText,
      game:         c.game ?? null,
      name:         c.name,
      rarity:       c.rarity ?? null,
      version:      c.version ?? null,
      condition:    c.condition,
      searchKeyword: c.searchKeyword,
      confidence:   c.confidence,
      status:
        c.confidence >= 90 ? "auto_candidate" :
        c.confidence >= 60 ? "pending"         :
        "held",
    })),
  });

  // id を返すために直近を取得
  const saved = await prisma.cardCandidate.findMany({
    where:   { inputText: { in: parsed.map((c) => c.inputText) } },
    orderBy: { createdAt: "desc" },
    take:    parsed.length,
  });

  // withMeta に id をマージ
  const enriched = withMeta.map((c) => {
    const row = saved.find((s) => s.inputText === c.inputText);
    return { ...c, id: row?.id, status: row?.status };
  });

  return NextResponse.json({ ok: true, created: created.count, candidates: enriched });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const sp     = new URL(req.url).searchParams;
  const status = sp.get("status") ?? "pending";
  const rows   = await prisma.cardCandidate.findMany({
    where:   status === "all" ? {} : { status },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take:    200,
  });
  return NextResponse.json({ ok: true, candidates: rows });
}
