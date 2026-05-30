/**
 * POST /api/v1/cards/bulk-add
 *
 * Pokemon TCG API から選択したカードを一括登録する。
 *
 * 1. Card テーブルに upsert（name/setName/rarity/condition の組み合わせで重複回避）
 * 2. data/watchlist.csv に新規エントリを追記
 *
 * Body:
 * {
 *   cards: Array<{
 *     game:       string,
 *     name:       string,
 *     setName:    string,
 *     rarity:     string,
 *     conditions: string[],   // ["NM","LP",...]
 *     minPrice:   number,
 *     maxPrice:   number,
 *     ptcgId?:    string,
 *     number?:    string,
 *   }>
 * }
 *
 * Response: { ok, created, skipped }
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve }                  from "node:path";
import { prisma }                   from "@gci/db";
import { timingSafeEqual, cardSlug } from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret  = process.env.CRON_SECRET ?? "";
  const auth    = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

type CardInput = {
  game:       string;
  name:       string;
  setName:    string;
  rarity:     string;
  conditions: string[];
  minPrice:   number;
  maxPrice:   number;
  ptcgId?:    string;
  number?:    string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { cards: CardInput[] };
  try {
    body = await req.json();
    if (!Array.isArray(body.cards) || body.cards.length === 0) {
      return NextResponse.json({ ok: false, error: "cards[] required" }, { status: 400 });
    }
    if (body.cards.length > 500) {
      return NextResponse.json({ ok: false, error: "max 500 cards" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  let created = 0;
  let skipped = 0;

  // 各カード × 各コンディションで DB upsert
  const newWatchlistRows: string[] = [];

  for (const input of body.cards) {
    for (const condition of (input.conditions.length ? input.conditions : ["NM"])) {
      try {
        const slug = cardSlug(input.name, input.setName, input.rarity, condition);

        const existing = await prisma.card.findFirst({
          where: {
            name:      input.name,
            setName:   input.setName,
            rarity:    input.rarity,
            condition,
          },
          select: { id: true },
        });

        if (existing) {
          skipped++;
        } else {
          await prisma.card.create({
            data: {
              name:      input.name,
              setName:   input.setName,
              rarity:    input.rarity,
              condition,
              game:      input.game || "pokemon",
              slug,
            },
          });
          created++;

          // watchlist.csv 用の行を追加（コンディションをまとめて）
          // 最初のコンディションでまとめ行を作る（あとで重複行除去済み）
        }
      } catch {
        skipped++;
      }
    }

    // watchlist.csv に追記する行を作成
    // 各カードにつき1行（コンディションはカンマ区切り）
    const escapedConditions = input.conditions.join(",");
    const keyword = `${input.name} ${input.rarity} ${input.setName}`.trim();
    newWatchlistRows.push(
      `${input.game},${input.name},${input.setName},${input.rarity},"${escapedConditions}",${input.minPrice},${input.maxPrice},${keyword},true`
    );
  }

  // watchlist.csv に追記
  try {
    const csvPath = resolve(process.cwd(), "../../data/watchlist.csv");
    if (existsSync(csvPath)) {
      const existing = readFileSync(csvPath, "utf-8").trimEnd();
      // 重複行除去: キー = game+name+setName+rarity
      const existingLines = new Set(existing.split("\n").slice(1)); // ヘッダー除く
      const toAdd = newWatchlistRows.filter((r) => !existingLines.has(r));
      if (toAdd.length > 0) {
        writeFileSync(csvPath, existing + "\n" + toAdd.join("\n") + "\n", "utf-8");
      }
    }
  } catch {
    // watchlist.csv 更新失敗は致命的でないのでスキップ
  }

  return NextResponse.json({ ok: true, created, skipped });
}
