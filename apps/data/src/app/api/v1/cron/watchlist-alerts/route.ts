/**
 * GET/POST /api/v1/cron/watchlist-alerts
 *
 * 15%以上の指数変動を検知し、対象カードをウォッチリストに登録している
 * ユーザーへ個別にアラートメールを送信する（Week 23 per-user版）。
 *
 * Vercel cron: 毎日 03:30 JST（18:30 UTC）— recalc（01:00 UTC）の後
 *
 * モード:
 *   ?dry=1                  … 送信なし、対象ユーザー数・カード数を返す（デフォルト）
 *   ?test=email@example.com … 全変動カードを1通だけ送信してテスト
 *   (なし + SEND_ENABLED)   … 対象ユーザー全員に個別送信
 *
 * 設定:
 *   ALERT_SEND_ENABLED="true"   — 実配信フラグ（デフォルト off）
 *   ALERT_THRESHOLD_PCT="15"    — 変動率しきい値（デフォルト 15%）
 *   ALERT_LOOKBACK_HOURS="4"    — 何時間以内の IndexValue を見るか（デフォルト 4）
 */

import { NextRequest, NextResponse }    from "next/server";
import { prisma }                       from "@gci/db";
import { authorizeCron, writeCronLog }  from "@gci/core";
import {
  buildMarketAlertEmail,
  sendEmail,
  checkResendEnv,
  type AlertCard,
}                                       from "@gci/email";

export const dynamic = "force-dynamic";

const SEND_ENABLED   = process.env.ALERT_SEND_ENABLED === "true";
const THRESHOLD      = Number(process.env.ALERT_THRESHOLD_PCT  ?? "15");
const LOOKBACK_HOURS = Number(process.env.ALERT_LOOKBACK_HOURS ?? "4");

// ── Types ─────────────────────────────────────────────────────────────────────

type AlertCardWithId = AlertCard & { cardId: string };

type UserAlert = {
  userId:   string;
  email:    string;
  unsubUrl: string;
  cards:    AlertCard[];
};

// ── Data fetch ────────────────────────────────────────────────────────────────

/**
 * Returns the most-recent IndexValue entry per card where |changeRate| >= THRESHOLD.
 */
async function getAlertCardMap(): Promise<Map<string, AlertCardWithId>> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);

  const rows = await prisma.indexValue.findMany({
    where: {
      calculatedAt: { gte: since },
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

  // Keep most-recent per card, filter by threshold
  const map = new Map<string, AlertCardWithId>();
  for (const row of rows) {
    if (!row.card || !row.cardId) continue;
    if (map.has(row.cardId)) continue;            // already have most-recent

    const rate = row.changeRate ?? 0;
    if (Math.abs(rate) < THRESHOLD) continue;

    map.set(row.cardId, {
      cardId:    row.cardId,
      name:      row.card.name,
      setName:   row.card.setName,
      rarity:    row.card.rarity,
      condition: row.card.condition,
      slug:      row.card.slug,
      changeRate: rate,
      value:      row.value,
    });
  }

  return map;
}

/**
 * For each user who:
 *   - has at least one of the alerting cards in their UserWatchlistItem
 *   - has NotificationPrefs.marketAlerts = true (or no prefs row → default true)
 *   - has a valid email address
 *
 * Returns one UserAlert object per user with only their matching cards.
 */
async function buildUserAlerts(
  alertCardMap: Map<string, AlertCardWithId>,
  baseUrl: string,
): Promise<UserAlert[]> {
  if (alertCardMap.size === 0) return [];

  const alertCardIds = [...alertCardMap.keys()];

  // Find watchlist items for the alerting cards, including user + notif prefs
  const watchItems = await prisma.userWatchlistItem.findMany({
    where: {
      cardId: { in: alertCardIds },
      user: {
        // Only users whose marketAlerts is true (or who have no prefs row yet — handled below)
        OR: [
          { notifPrefs: null },
          { notifPrefs: { marketAlerts: true } },
        ],
      },
    },
    select: {
      cardId: true,
      user: {
        select: {
          id:    true,
          email: true,
          notifPrefs: { select: { marketAlerts: true } },
        },
      },
    },
  });

  // Group by userId
  const byUser = new Map<string, { email: string; cardIds: Set<string> }>();
  for (const item of watchItems) {
    if (!item.user.email) continue;
    // Double-check marketAlerts (null prefs defaults to true)
    const wantsAlerts = item.user.notifPrefs?.marketAlerts ?? true;
    if (!wantsAlerts) continue;

    const existing = byUser.get(item.user.id);
    if (existing) {
      existing.cardIds.add(item.cardId);
    } else {
      byUser.set(item.user.id, {
        email:   item.user.email,
        cardIds: new Set([item.cardId]),
      });
    }
  }

  // Build UserAlert list
  const results: UserAlert[] = [];
  for (const [userId, { email, cardIds }] of byUser) {
    const cards = [...cardIds]
      .map((id) => alertCardMap.get(id))
      .filter((c): c is AlertCardWithId => c !== undefined)
      .sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));

    if (cards.length === 0) continue;

    // Use userId as an opaque unsubscribe token (no real unsubscribe page yet — links to /account)
    const unsubUrl = `${baseUrl}/account`;

    results.push({ userId, email, unsubUrl, cards });
  }

  return results;
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handle(req: NextRequest) {
  const authError = authorizeCron(req);
  if (authError) return authError;

  const sp        = req.nextUrl.searchParams;
  const isDry     = sp.get("dry") === "1" || (!SEND_ENABLED && !sp.get("test"));
  const testEmail = sp.get("test")?.trim().toLowerCase() ?? null;
  const start     = Date.now();
  const today     = new Date().toLocaleDateString("sv-SE");
  const baseUrl   = process.env.NEXT_PUBLIC_BASE_URL || "https://globalcardindex.com";

  const alertCardMap = await getAlertCardMap();

  // Nothing to alert
  if (alertCardMap.size === 0) {
    await writeCronLog("watchlist-alerts", "ok", {
      durationMs:  Date.now() - start,
      triggeredBy: "cron",
      result: {
        skipped:   true,
        reason:    "no cards exceed threshold",
        threshold: THRESHOLD,
      } as Record<string, unknown>,
    });
    return NextResponse.json({
      ok:      true,
      date:    today,
      skipped: true,
      reason:  `変動 ${THRESHOLD}% 以上のカードがありません（直近 ${LOOKBACK_HOURS}h）`,
    });
  }

  // ── Dry run ────────────────────────────────────────────────────────────────
  if (isDry) {
    const userAlerts  = await buildUserAlerts(alertCardMap, baseUrl);
    const totalCards  = alertCardMap.size;
    const totalUsers  = userAlerts.length;
    const preview     = [...alertCardMap.values()]
      .sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate))
      .slice(0, 10)
      .map(({ cardId: _id, ...rest }) => rest);   // strip internal cardId

    await writeCronLog("watchlist-alerts", "ok", {
      durationMs:  Date.now() - start,
      triggeredBy: "cron",
      isDry:       true,
      result: { totalCards, totalUsers } as Record<string, unknown>,
    });
    return NextResponse.json({
      ok:         true,
      mode:       "dry",
      date:       today,
      totalCards,
      totalUsers,
      cards:      preview,
      note:       "実際の送信は行われていません。ALERT_SEND_ENABLED=true で有効化。",
    });
  }

  // ── Check Resend env ───────────────────────────────────────────────────────
  const { ok: envOk, missing } = checkResendEnv();
  if (!envOk) {
    return NextResponse.json(
      { ok: false, error: `Missing env vars: ${missing.join(", ")}` },
      { status: 500 },
    );
  }

  // ── Test send (one email with all alert cards) ─────────────────────────────
  if (testEmail) {
    const allCards    = [...alertCardMap.values()]
      .sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));
    const unsubUrl    = `${baseUrl}/account`;
    const payload     = buildMarketAlertEmail({ to: testEmail, cards: allCards, unsubUrl, date: today });
    const result      = await sendEmail(payload);
    const durMs       = Date.now() - start;

    await writeCronLog("watchlist-alerts", result.error ? "error" : "ok", {
      durationMs:   durMs,
      triggeredBy:  "manual",
      errorMessage: result.error ?? undefined,
      result: {
        mode:       "test",
        to:         testEmail,
        alertCards: allCards.length,
      } as Record<string, unknown>,
    });

    if (result.error) {
      return NextResponse.json({ ok: false, mode: "test", error: result.error }, { status: 500 });
    }
    return NextResponse.json({
      ok:         true,
      mode:       "test",
      to:         testEmail,
      alertCards: allCards.length,
      resendId:   result.id,
      durationMs: durMs,
    });
  }

  // ── Live send — per-user personalized emails ───────────────────────────────
  const userAlerts = await buildUserAlerts(alertCardMap, baseUrl);
  let sent = 0;
  let errs = 0;

  for (const ua of userAlerts) {
    const payload = buildMarketAlertEmail({
      to:       ua.email,
      cards:    ua.cards,
      unsubUrl: ua.unsubUrl,
      date:     today,
    });
    const result = await sendEmail(payload);
    if (result.error) errs++;
    else sent++;
  }

  const durMs = Date.now() - start;

  await writeCronLog(
    "watchlist-alerts",
    errs > 0 && sent === 0 ? "error" : "ok",
    {
      durationMs:  durMs,
      triggeredBy: "cron",
      result: {
        alertCards:  alertCardMap.size,
        targetUsers: userAlerts.length,
        sent,
        errors:      errs,
      } as Record<string, unknown>,
    },
  );

  return NextResponse.json({
    ok:         true,
    mode:       "live",
    date:       today,
    alertCards: alertCardMap.size,
    targetUsers: userAlerts.length,
    sent,
    errors:     errs,
    durationMs: durMs,
  });
}

export const GET  = handle;
export const POST = handle;
