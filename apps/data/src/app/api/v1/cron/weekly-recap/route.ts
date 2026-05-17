/**
 * GET/POST /api/v1/cron/weekly-recap
 *
 * 週次市場まとめをニュースレター購読者と Discord に送信する。
 *
 * Vercel cron: 毎週月曜 09:00 JST（00:00 UTC Monday）
 *
 * 内容:
 *   - 過去7日間で変動率が大きかったカード TOP 5（急騰 / 急落）
 *   - 過去7日間に新規追加されたカード
 *   - 直近のリクエスト人気 TOP 5
 *
 * モード:
 *   ?dry=1                  … 送信なし（デフォルト）
 *   ?test=email@example.com … テスト送信
 *   (なし + SEND_ENABLED)   … 全購読者に配信 + Discord 投稿
 *
 * 環境変数:
 *   WEEKLY_SEND_ENABLED="true"  — 実配信フラグ
 *   DISCORD_WEBHOOK_ALERTS      — Discord 投稿先（既存変数を流用）
 */

import { NextRequest, NextResponse }   from "next/server";
import { prisma }                      from "@gci/db";
import { authorizeCron, writeCronLog } from "@gci/core";
import {
  buildWeeklyRecapEmail,
  sendEmail,
  checkResendEnv,
  type WeeklyRecapData,
}                                      from "@gci/email";
import { getActiveSubscribers }        from "@gci/core";

export const dynamic = "force-dynamic";

const SEND_ENABLED = process.env.WEEKLY_SEND_ENABLED === "true";

// ── Week label ────────────────────────────────────────────────────────────────

function getWeekLabel(d = new Date()): string {
  const jan1  = new Date(d.getFullYear(), 0, 1);
  const week  = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ── Build recap data ──────────────────────────────────────────────────────────

async function buildWeeklyData(): Promise<WeeklyRecapData> {
  const now   = new Date();
  const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Top movers: cards with |changeRate| calculated in the past 7d
  const movers = await prisma.indexValue.findMany({
    where: {
      calculatedAt: { gte: ago7d },
      cardId:       { not: null },
    },
    orderBy: { calculatedAt: "desc" },
    include: {
      card: {
        select: {
          id:        true,
          name:      true,
          setName:   true,
          rarity:    true,
          condition: true,
          slug:      true,
        },
      },
    },
  });

  // De-duplicate by cardId (keep most recent entry)
  const seen   = new Set<string>();
  const unique = movers.filter((r) => {
    if (!r.cardId || seen.has(r.cardId)) return false;
    seen.add(r.cardId);
    return true;
  });

  const withCard = unique.filter((r) => r.card !== null);

  const sorted = withCard.sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));

  const topGainers = sorted
    .filter((r) => (r.changeRate ?? 0) > 0)
    .slice(0, 5)
    .map((r) => ({
      name:       r.card!.name,
      setName:    r.card!.setName,
      rarity:     r.card!.rarity,
      condition:  r.card!.condition,
      slug:       r.card!.slug,
      changeRate: r.changeRate ?? 0,
      value:      r.value,
    }));

  const topLosers = sorted
    .filter((r) => (r.changeRate ?? 0) < 0)
    .slice(0, 5)
    .map((r) => ({
      name:       r.card!.name,
      setName:    r.card!.setName,
      rarity:     r.card!.rarity,
      condition:  r.card!.condition,
      slug:       r.card!.slug,
      changeRate: r.changeRate ?? 0,
      value:      r.value,
    }));

  // New cards added this week
  const newCardRows = await prisma.card.findMany({
    where:   { createdAt: { gte: ago7d } },
    orderBy: { createdAt: "desc" },
    take:    10,
    select:  { name: true, setName: true, rarity: true },
  });

  // Top requested cards (pending only)
  const requestedGroups = await prisma.cardRequest.groupBy({
    by:      ["name", "game"],
    where:   { status: "pending" },
    _count:  { id: true },
    orderBy: { _count: { id: "desc" } },
    take:    5,
  });

  return {
    weekLabel:    getWeekLabel(),
    topGainers,
    topLosers,
    newCards:     newCardRows,
    confUpgrades: [],  // Future: track confidence tier changes in DB
    topRequested: requestedGroups.map((g) => ({
      name:  g.name,
      game:  g.game,
      count: g._count.id,
    })),
  };
}

// ── Discord post ──────────────────────────────────────────────────────────────

async function postWeeklyDiscord(data: WeeklyRecapData): Promise<void> {
  const webhook = process.env.DISCORD_WEBHOOK_ALERTS;
  if (!webhook) return;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";

  const gainersText = data.topGainers.length > 0
    ? data.topGainers.map((c) => `**▲${c.changeRate.toFixed(1)}%** ${c.name}`).join("\n")
    : "_なし_";

  const losersText = data.topLosers.length > 0
    ? data.topLosers.map((c) => `**▼${Math.abs(c.changeRate).toFixed(1)}%** ${c.name}`).join("\n")
    : "_なし_";

  const embed = {
    title:       `📊 週次まとめ ${data.weekLabel}`,
    color:       0x1a1a2e,
    fields: [
      {
        name:   "🔥 今週の急騰",
        value:  gainersText,
        inline: true,
      },
      {
        name:   "📉 今週の急落",
        value:  losersText,
        inline: true,
      },
      ...(data.newCards.length > 0 ? [{
        name:   "✨ 新規追加",
        value:  data.newCards.slice(0, 5).map((c) => `${c.name} (${c.rarity})`).join("\n"),
        inline: false,
      }] : []),
      ...(data.topRequested.length > 0 ? [{
        name:   "📋 注目リクエスト",
        value:  data.topRequested.map((r) => `${r.name} (${r.count}件)`).join("\n"),
        inline: false,
      }] : []),
    ],
    footer: { text: "Global Card Index" },
    url: `${baseUrl}/daily`,
  };

  await fetch(webhook, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ embeds: [embed] }),
  }).catch(() => undefined);
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handle(req: NextRequest) {
  const authError = authorizeCron(req);
  if (authError) return authError;

  const sp        = req.nextUrl.searchParams;
  const isDry     = sp.get("dry") === "1" || (!SEND_ENABLED && !sp.get("test"));
  const testEmail = sp.get("test")?.trim().toLowerCase() ?? null;
  const start     = Date.now();

  const data = await buildWeeklyData();

  // Dry run
  if (isDry) {
    const subscribers = await getActiveSubscribers();
    await writeCronLog("weekly-recap", "ok", {
      durationMs:  Date.now() - start,
      triggeredBy: "cron",
      isDry:       true,
      result: {
        weekLabel:    data.weekLabel,
        topGainers:   data.topGainers.length,
        topLosers:    data.topLosers.length,
        newCards:     data.newCards.length,
        topRequested: data.topRequested.length,
        wouldSend:    subscribers.length,
      } as Record<string, unknown>,
    });
    return NextResponse.json({
      ok:        true,
      mode:      "dry",
      weekLabel: data.weekLabel,
      data: {
        topGainers:   data.topGainers.length,
        topLosers:    data.topLosers.length,
        newCards:     data.newCards.length,
        topRequested: data.topRequested.length,
      },
      wouldSend:  subscribers.length,
      note:       "WEEKLY_SEND_ENABLED=true で実配信を有効化できます。",
    });
  }

  // Env check
  const { ok: envOk, missing } = checkResendEnv();
  if (!envOk) {
    return NextResponse.json(
      { ok: false, error: `Missing env vars: ${missing.join(", ")}` },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";

  // Test send
  if (testEmail) {
    const unsubUrl = `${baseUrl}/newsletter/unsubscribe/test-weekly-no-token`;
    const payload  = buildWeeklyRecapEmail({ to: testEmail, data, unsubUrl });
    const result   = await sendEmail(payload);
    const durMs    = Date.now() - start;
    await writeCronLog("weekly-recap", result.error ? "error" : "ok", {
      durationMs:   durMs,
      triggeredBy:  "manual",
      errorMessage: result.error ?? undefined,
      result: { mode: "test", to: testEmail } as Record<string, unknown>,
    });
    if (result.error) {
      return NextResponse.json({ ok: false, mode: "test", error: result.error }, { status: 500 });
    }
    return NextResponse.json({
      ok:         true,
      mode:       "test",
      to:         testEmail,
      weekLabel:  data.weekLabel,
      resendId:   result.id,
      durationMs: durMs,
    });
  }

  // Live — newsletter + Discord
  const subscribers = await getActiveSubscribers();
  let sent = 0;
  let errs = 0;

  for (const sub of subscribers) {
    const unsubUrl = `${baseUrl}/newsletter/unsubscribe/${sub.token}`;
    const payload  = buildWeeklyRecapEmail({ to: sub.email, data, unsubUrl });
    const result   = await sendEmail(payload);
    if (result.error) errs++;
    else sent++;
  }

  // Discord post (non-blocking)
  void postWeeklyDiscord(data);

  const durMs = Date.now() - start;

  await writeCronLog("weekly-recap", errs > 0 && sent === 0 ? "error" : "ok", {
    durationMs:  durMs,
    triggeredBy: "cron",
    result: {
      weekLabel: data.weekLabel,
      sent,
      errors:    errs,
      total:     subscribers.length,
    } as Record<string, unknown>,
  });

  return NextResponse.json({
    ok:         true,
    mode:       "live",
    weekLabel:  data.weekLabel,
    sent,
    errors:     errs,
    durationMs: durMs,
  });
}

export const GET  = handle;
export const POST = handle;
