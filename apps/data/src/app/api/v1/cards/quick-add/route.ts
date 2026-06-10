/**
 * POST /api/v1/cards/quick-add
 *
 * 管理画面フォームからカードを1件登録する。
 * - Card レコードを DB に作成（NM / PSA10）
 * - data/watchlist.csv に正しいフォーマットで追記
 *
 * Body:
 * {
 *   game:      string
 *   name:      string
 *   setName:   string
 *   rarity:    string
 *   normalMin: number
 *   normalMax: number
 *   addPsa10:  boolean
 *   psa10Min?: number
 *   psa10Max?: number
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve }   from "node:path";
import { prisma }    from "@gci/db";
import { timingSafeEqual, cardSlug } from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret  = process.env.CRON_SECRET ?? "";
  const header  = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && header.startsWith("Bearer ") &&
      timingSafeEqual(header.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

type Body = {
  game:      string;
  name:      string;
  setName:   string;
  rarity:    string;
  normalMin: number;
  normalMax: number;
  addPsa10:  boolean;
  psa10Min?: number;
  psa10Max?: number;
};

function csvRow(
  game: string, name: string, setName: string, rarity: string,
  conditions: string, minPrice: number, maxPrice: number, keywords: string,
): string {
  // setName や name にカンマが含まれる場合を考慮してダブルクォート
  const q = (s: string) => s.includes(",") ? `"${s}"` : s;
  return `${game},${q(name)},${q(setName)},${q(rarity)},${conditions},${minPrice},${maxPrice},${keywords},true`;
}

async function createCard(
  game: string, name: string, setName: string, rarity: string, condition: string,
): Promise<"created" | "skipped"> {
  const existing = await prisma.card.findUnique({
    where: { name_setName_rarity_condition: { name, setName, rarity, condition } },
    select: { id: true },
  });
  if (existing) return "skipped";

  const slug     = cardSlug(name, setName, rarity, condition);
  const slugUsed = await prisma.card.findUnique({ where: { slug }, select: { id: true } });
  await prisma.card.create({
    data: {
      name, setName, rarity, condition, game,
      slug: slugUsed ? `${slug}-${Date.now()}` : slug,
    },
  });
  return "created";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
    if (!body.game || !body.name || !body.setName || !body.rarity) {
      return NextResponse.json({ ok: false, error: "game/name/setName/rarity required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const { game, name, setName, rarity, normalMin, normalMax, addPsa10, psa10Min, psa10Max } = body;
  const results: string[] = [];

  // 1. 通常版（NM）を DB 登録
  const normalStatus = await createCard(game, name, setName, rarity, "NM");
  results.push(`NM: ${normalStatus}`);

  // 2. PSA10 版を DB 登録
  if (addPsa10) {
    const psa10Status = await createCard(game, name, setName, rarity, "PSA10");
    results.push(`PSA10: ${psa10Status}`);
  }

  // 3. watchlist.csv に追記
  const csvPath = resolve(process.cwd(), "../../data/watchlist.csv");
  if (existsSync(csvPath)) {
    try {
      const existing = readFileSync(csvPath, "utf-8").trimEnd();
      const existingSet = new Set(existing.split("\n").slice(1));

      const keyword     = `${name} ${rarity} ${setName}`.trim();
      const keywordPsa  = `${name} ${rarity} ${setName} PSA10`.trim();

      const rowNormal = csvRow(game, name, setName, rarity, `"NM,LP"`, normalMin, normalMax, keyword);
      const rowPsa10  = csvRow(game, name, setName, rarity, `"NM"`,    psa10Min ?? normalMin * 3, psa10Max ?? normalMax * 4, keywordPsa);

      const toAdd: string[] = [];
      if (!existingSet.has(rowNormal)) toAdd.push(rowNormal);
      if (addPsa10 && !existingSet.has(rowPsa10)) toAdd.push(rowPsa10);

      if (toAdd.length > 0) {
        writeFileSync(csvPath, existing + "\n" + toAdd.join("\n") + "\n", "utf-8");
      }
    } catch {
      // CSV 更新失敗は致命的でないのでスキップ
    }
  }

  const created = results.filter((r) => r.includes("created")).length;
  const skipped = results.filter((r) => r.includes("skipped")).length;
  return NextResponse.json({ ok: true, created, skipped, details: results });
}
