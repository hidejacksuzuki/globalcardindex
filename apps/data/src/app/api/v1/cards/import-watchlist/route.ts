/**
 * POST /api/v1/cards/import-watchlist
 *
 * data/watchlist.csv を読み込み、Card レコードを upsert する。
 * 既存カードはスキップ（name+setName+rarity+condition のユニーク制約）。
 *
 * condition マッピング:
 *   watchlist の conditions "NM,LP" → Card condition "NM"
 *   watchlist の conditions "NM" (psa10行) → Card condition "PSA10"
 *
 * Response: { ok, created, skipped, total }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual, parseWatchlistCsv } from "@gci/core";
import { readFileSync }              from "node:fs";
import { resolve }                   from "node:path";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret  = process.env.CRON_SECRET ?? "";
  const auth    = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

/** カード名・セット・レアリティ・コンディションから URL-safe スラッグを生成 */
function makeSlug(name: string, setName: string, rarity: string, condition: string): string {
  const raw = `${name} ${setName} ${rarity} ${condition}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")   // 記号除去（日本語は保持）
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return raw;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // watchlist.csv 読み込み
  let csv: string;
  try {
    const csvPath = resolve(process.cwd(), "../../data/watchlist.csv");
    csv = readFileSync(csvPath, "utf-8");
  } catch {
    return NextResponse.json({ ok: false, error: "watchlist.csv が見つかりません" }, { status: 500 });
  }

  const entries = parseWatchlistCsv(csv);
  if (entries.length === 0) {
    return NextResponse.json({ ok: false, error: "watchlist にエントリがありません" }, { status: 400 });
  }

  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    // PSA10 行は conditions が ["NM"] のみ かつ keywords に "PSA10" を含む
    const isPsa10 = entry.keywords.toUpperCase().includes("PSA10");
    const condition = isPsa10 ? "PSA10" : "NM";

    const name    = entry.cardName;
    const setName = entry.set;
    const rarity  = entry.rarity;
    const game    = entry.game;

    // スラッグ候補生成（衝突時は末尾に連番を付与）
    const slugBase = makeSlug(name, setName, rarity, condition);

    try {
      // upsert: 同一 name+setName+rarity+condition があればスキップ
      const existing = await prisma.card.findUnique({
        where: { name_setName_rarity_condition: { name, setName, rarity, condition } },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // スラッグ衝突回避
      const slugExists = await prisma.card.findUnique({
        where: { slug: slugBase },
        select: { id: true },
      });
      const slug = slugExists ? `${slugBase}-${Date.now()}` : slugBase;

      await prisma.card.create({
        data: { name, setName, rarity, condition, game, slug },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, created, skipped, total: entries.length });
}
