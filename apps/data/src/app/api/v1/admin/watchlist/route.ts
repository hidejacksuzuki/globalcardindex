/**
 * POST /api/v1/admin/watchlist
 *
 * DB の Card テーブル全件から watchlist.csv を再生成する。
 *
 * レアリティ別デフォルト価格帯:
 *   SAR / SSR / CSR / HR   : 3,000 – 200,000  (NM,LP + PSA行)
 *   SR  / SER / AR  / CHR  : 1,000 –  80,000
 *   RRR / ACE               :   800 –  30,000
 *   RR                      :   300 –  10,000
 *   R / PR / TR             :   100 –   5,000
 *   その他                  :   100 –   3,000
 *
 * 各カードにつき 2 行を生成:
 *   1. 通常品 (NM,LP)
 *   2. PSA10 専用行 (NMのみ、価格帯 3倍)
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFileSync }             from "node:fs";
import { resolve }                   from "node:path";
import { prisma }                    from "@gci/db";
import { timingSafeEqual }           from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret  = process.env.CRON_SECRET ?? "";
  const auth    = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

// ── レアリティ別デフォルト ─────────────────────────────────────────────────────

type RarityTier = {
  minPrice: number;
  maxPrice: number;
  psaMultiplier: number;  // PSA10 行の価格倍率
  addPsa: boolean;        // PSA10 行を追加するか
};

const RARITY_TIERS: Record<string, RarityTier> = {
  // 最高レア
  SAR:  { minPrice: 3000,  maxPrice: 200000, psaMultiplier: 3, addPsa: true },
  SSR:  { minPrice: 3000,  maxPrice: 200000, psaMultiplier: 3, addPsa: true },
  CSR:  { minPrice: 3000,  maxPrice: 150000, psaMultiplier: 3, addPsa: true },
  HR:   { minPrice: 3000,  maxPrice: 150000, psaMultiplier: 3, addPsa: true },
  UR:   { minPrice: 3000,  maxPrice: 150000, psaMultiplier: 3, addPsa: true },
  // 高レア
  SR:   { minPrice: 1000,  maxPrice:  80000, psaMultiplier: 3, addPsa: true },
  SER:  { minPrice: 1000,  maxPrice:  80000, psaMultiplier: 3, addPsa: true },
  AR:   { minPrice: 1000,  maxPrice:  50000, psaMultiplier: 3, addPsa: true },
  CHR:  { minPrice: 1000,  maxPrice:  50000, psaMultiplier: 3, addPsa: true },
  "K":  { minPrice: 1000,  maxPrice:  50000, psaMultiplier: 3, addPsa: true },
  // 中レア
  RRR:  { minPrice:  800,  maxPrice:  30000, psaMultiplier: 2, addPsa: true },
  ACE:  { minPrice:  800,  maxPrice:  30000, psaMultiplier: 2, addPsa: true },
  // 低レア
  RR:   { minPrice:  300,  maxPrice:  10000, psaMultiplier: 2, addPsa: false },
  R:    { minPrice:  100,  maxPrice:   5000, psaMultiplier: 2, addPsa: false },
  PR:   { minPrice:  100,  maxPrice:   5000, psaMultiplier: 2, addPsa: false },
  TR:   { minPrice:  100,  maxPrice:   5000, psaMultiplier: 2, addPsa: false },
};

const DEFAULT_TIER: RarityTier = {
  minPrice: 100, maxPrice: 3000, psaMultiplier: 2, addPsa: false,
};

function getTier(rarity: string): RarityTier {
  const key = rarity.toUpperCase().trim();
  return RARITY_TIERS[key] ?? DEFAULT_TIER;
}

// ── CSV 生成 ───────────────────────────────────────────────────────────────────

function escapeField(s: string): string {
  if (s.includes(",") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const dryRun = (await req.json().catch(() => ({}))).dry === true;

  const cards = await prisma.card.findMany({
    orderBy: [{ game: "asc" }, { setName: "asc" }, { name: "asc" }, { rarity: "asc" }],
    select:  { game: true, name: true, setName: true, rarity: true },
  });

  if (!cards.length) {
    return NextResponse.json({ ok: false, error: "no cards in DB" }, { status: 400 });
  }

  // 重複排除: game+name+setName+rarity でユニーク
  const seen    = new Set<string>();
  const rows: string[] = ["game,cardName,set,rarity,conditions,minPrice,maxPrice,keywords,active"];

  for (const card of cards) {
    const dedupeKey = `${card.game}|${card.name}|${card.setName}|${card.rarity}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const tier     = getTier(card.rarity);
    const game     = card.game ?? "pokemon";
    const keyword  = `${card.name} ${card.rarity} ${card.setName}`.trim();

    // 通常品行
    rows.push([
      game,
      escapeField(card.name),
      escapeField(card.setName),
      card.rarity,
      escapeField("NM,LP"),
      tier.minPrice,
      tier.maxPrice,
      escapeField(keyword),
      "true",
    ].join(","));

    // PSA10 専用行
    if (tier.addPsa) {
      rows.push([
        game,
        escapeField(card.name),
        escapeField(card.setName),
        card.rarity,
        "NM",
        Math.round(tier.minPrice * tier.psaMultiplier),
        Math.round(tier.maxPrice * tier.psaMultiplier),
        escapeField(`${keyword} PSA10`),
        "true",
      ].join(","));
    }
  }

  const csv = rows.join("\n") + "\n";

  if (!dryRun) {
    const csvPath = resolve(process.cwd(), "../../data/watchlist.csv");
    writeFileSync(csvPath, csv, "utf-8");
  }

  return NextResponse.json({
    ok:       true,
    rows:     rows.length - 1, // ヘッダー除く
    cards:    seen.size,
    dryRun,
    preview:  rows.slice(0, 6),
  });
}
