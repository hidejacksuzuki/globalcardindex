/**
 * POST /api/v1/cron/sync-cards
 *
 * data/watchlist.csv を読み込み、Card レコードを自動登録する cron エンドポイント。
 * 既存カードはスキップ（name+setName+rarity+condition のユニーク制約）。
 *
 * Auth: CRON_SECRET
 * Schedule: 毎日 JST 8:30 (UTC 23:30) — vercel.json 参照
 *
 * Response: { ok, created, skipped, total }
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync }              from "node:fs";
import { resolve }                   from "node:path";
import { prisma }                    from "@gci/db";
import { parseWatchlistCsv, timingSafeEqual, writeCronLog } from "@gci/core";

export const dynamic = "force-dynamic";

/**
 * CRON_SECRET による Bearer 認証。Vercel Cron が Bearer ヘッダーを付与する。
 *
 * セキュリティ監査 (2026-07-06): 以前は Referer ヘッダーに "/admin/" が
 * 含まれていれば認証を通す抜け道があった。Referer は攻撃者が任意に設定できる
 * ため実質認証なしで呼び出せてしまっていた。Bearer 認証のみに限定する。
 */
function isAuthorized(req: NextRequest): boolean {
  const secret  = process.env.CRON_SECRET ?? "";
  const header  = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && header.startsWith("Bearer ") &&
      timingSafeEqual(header.slice(7).trim(), secret)) return true;
  return process.env.NODE_ENV !== "production";
}

/** カード名・セット・レアリティ・コンディションから URL-safe スラッグを生成 */
function makeSlug(name: string, setName: string, rarity: string, condition: string): string {
  return `${name} ${setName} ${rarity} ${condition}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

async function syncCards(dryRun: boolean) {
  // watchlist.csv 読み込み
  const csvPath = resolve(process.cwd(), "../../data/watchlist.csv");
  const csv = readFileSync(csvPath, "utf-8");
  const entries = parseWatchlistCsv(csv);

  if (entries.length === 0) {
    return { created: 0, skipped: 0, total: 0, dryRun };
  }

  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    const isPsa10   = entry.keywords.toUpperCase().includes("PSA10");
    const condition = isPsa10 ? "PSA10" : "NM";

    const name    = entry.cardName;
    const setName = entry.set;
    const rarity  = entry.rarity;
    const game    = entry.game;

    // 既存チェック
    const existing = await prisma.card.findUnique({
      where: { name_setName_rarity_condition: { name, setName, rarity, condition } },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    if (dryRun) {
      created++;
      continue;
    }

    // スラッグ衝突回避
    const slugBase   = makeSlug(name, setName, rarity, condition);
    const slugExists = await prisma.card.findUnique({
      where:  { slug: slugBase },
      select: { id: true },
    });
    const slug = slugExists ? `${slugBase}-${Date.now()}` : slugBase;

    try {
      await prisma.card.create({
        data: { name, setName, rarity, condition, game, slug },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  return { created, skipped, total: entries.length, dryRun };
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const startAt = Date.now();
  const dryRun  = req.nextUrl.searchParams.get("dry") === "1";

  try {
    const result     = await syncCards(dryRun);
    const durationMs = Date.now() - startAt;

    await writeCronLog("sync-cards", "ok", { durationMs, ...result });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    await writeCronLog("sync-cards", "error", {
      durationMs: Date.now() - startAt,
      errorMessage: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET  = handle;
export const POST = handle;
