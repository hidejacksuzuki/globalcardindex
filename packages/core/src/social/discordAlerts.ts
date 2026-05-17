/**
 * discordAlerts.ts
 *
 * Discord market-alert webhooks — separate from the daily recap webhook.
 *
 * Channels:
 *   DISCORD_WEBHOOK_ALERTS  →  #market-alerts  (big movers ≥ ALERT_THRESHOLD)
 *   DISCORD_WEBHOOK_RISING  →  #rising-cards    (gainers only)
 *   DISCORD_WEBHOOK_LOG     →  #collector-log   (daily cron summary)
 *
 * All three are optional. Unset → that channel is silently skipped.
 *
 * Usage (called from recalcIndex after a full recalc run):
 *
 *   import { postMarketAlerts, postCollectorLog } from "../social/discordAlerts";
 *   await postMarketAlerts(cardSummary);
 *   await postCollectorLog(recalcResult);
 */

import type { CardRecalcEntry, CardRecalcSummary, RecalcResult } from "../jobs/recalcIndex";

// ── Config ────────────────────────────────────────────────────────────────────

/** Minimum absolute change rate (%) to appear in #market-alerts */
const ALERT_THRESHOLD = 10;

/** Maximum movers shown per alert embed */
const MAX_MOVERS = 10;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";

// ── Discord Embed types (minimal) ─────────────────────────────────────────────

type DiscordField = { name: string; value: string; inline: boolean };
type DiscordEmbed = {
  title:       string;
  description: string;
  color:       number;
  fields:      DiscordField[];
  footer:      { text: string };
  timestamp:   string;
};
type WebhookPayload = { username?: string; embeds: DiscordEmbed[] };

// ── Low-level send ────────────────────────────────────────────────────────────

async function sendWebhook(webhookUrl: string, payload: WebhookPayload): Promise<void> {
  const url = webhookUrl.includes("?")
    ? `${webhookUrl}&wait=true`
    : `${webhookUrl}?wait=true`;

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord webhook ${res.status}: ${text}`);
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtChange(rate: number): string {
  const sign  = rate > 0 ? "+" : "";
  const arrow = rate > 0 ? "📈" : "📉";
  return `${arrow} ${sign}${rate.toFixed(1)}%`;
}

function confidenceLabel(c: string | null): string {
  if (c === "HIGH") return "🟢";
  if (c === "MED")  return "🟡";
  if (c === "LOW")  return "🔴";
  return "⬜";
}

function cardUrl(cardId: string): string {
  return `${BASE_URL}/cards/${cardId}`;
}

// ── Alert embeds ──────────────────────────────────────────────────────────────

/**
 * Build a market-movers embed from a list of big-change entries.
 */
function buildMoversEmbed(
  movers: CardRecalcEntry[],
  direction: "all" | "rising",
): DiscordEmbed {
  const isAll   = direction === "all";
  const gainers = movers.filter((e) => (e.changeRate ?? 0) > 0);
  const losers  = movers.filter((e) => (e.changeRate ?? 0) < 0);

  const title = isAll
    ? `🚨 Market Alert — Big Movers (${movers.length})`
    : `📈 Rising Cards (${gainers.length})`;

  const color = isAll
    ? (gainers.length >= losers.length ? 0x2ECC71 : 0xE74C3C)
    : 0x2ECC71;

  const targetList = direction === "rising" ? gainers : movers;
  const lines = targetList.slice(0, MAX_MOVERS).map((e) => {
    const conf = confidenceLabel(e.confidence);
    const rate = fmtChange(e.changeRate ?? 0);
    const link = `[${e.name} (${e.condition})](${cardUrl(e.cardId)})`;
    return `${conf} ${link} — **${rate}**`;
  });

  const description = lines.length > 0
    ? lines.join("\n")
    : "変動カードなし";

  const fields: DiscordField[] = [];

  if (isAll && gainers.length > 0 && losers.length > 0) {
    fields.push(
      {
        name:   "📈 上昇",
        value:  String(gainers.length),
        inline: true,
      },
      {
        name:   "📉 下落",
        value:  String(losers.length),
        inline: true,
      },
    );
  }

  return {
    title,
    description,
    color,
    fields,
    footer: { text: "Global Card Index" },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a cron-summary embed for #collector-log.
 */
function buildLogEmbed(result: RecalcResult): DiscordEmbed {
  if (!result.saved) {
    return {
      title:       "🔄 Index Recalc — No Data",
      description: `理由: ${result.reason}`,
      color:       0x95A5A6,
      fields:      [],
      footer:      { text: "Global Card Index" },
      timestamp:   new Date().toISOString(),
    };
  }

  const sign      = result.changeRate > 0 ? "+" : "";
  const arrow     = result.changeRate > 0.1 ? "📈" : result.changeRate < -0.1 ? "📉" : "➡️";
  const globalLine = `GCI Index: **${result.value.toFixed(2)}** (${sign}${result.changeRate.toFixed(2)}%) ${arrow}`;

  const description = [
    globalLine,
    "",
    `カード更新: **${result.cards.updated}** / ${result.cards.processed}`,
    `スキップ: ${result.cards.skipped} | データなし: ${result.cards.noData}`,
  ].join("\n");

  // Top movers summary (up to 3)
  const topMovers = result.cards.entries
    .filter((e) => e.status === "updated" && Math.abs(e.changeRate ?? 0) >= ALERT_THRESHOLD)
    .sort((a, b) => Math.abs(b.changeRate ?? 0) - Math.abs(a.changeRate ?? 0))
    .slice(0, 3);

  const fields: DiscordField[] = [];
  if (topMovers.length > 0) {
    fields.push({
      name:   "🔝 Top Movers",
      value:  topMovers.map((e) => `${e.name} ${fmtChange(e.changeRate ?? 0)}`).join("\n"),
      inline: false,
    });
  }

  return {
    title:       `🔄 Index Recalc — ${new Date().toLocaleDateString("ja-JP")}`,
    description,
    color:       result.changeRate > 0.1 ? 0x2ECC71 : result.changeRate < -0.1 ? 0xE74C3C : 0x95A5A6,
    fields,
    footer:      { text: `confidence: ${result.confidence} · samples: ${result.sampleCount}` },
    timestamp:   new Date().toISOString(),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export type MarketAlertsResult = {
  alertsSent:  boolean;
  risingSent:  boolean;
  moverCount:  number;
  errors:      string[];
};

/**
 * Post big-mover alerts from a completed recalc run.
 * Fire-and-forget safe — catches all errors internally.
 */
export async function postMarketAlerts(
  cards: CardRecalcSummary,
): Promise<MarketAlertsResult> {
  const result: MarketAlertsResult = {
    alertsSent: false,
    risingSent: false,
    moverCount: 0,
    errors:     [],
  };

  // Find big movers from updated cards only
  const movers = cards.entries
    .filter(
      (e) =>
        e.status === "updated" &&
        e.changeRate !== null &&
        Math.abs(e.changeRate) >= ALERT_THRESHOLD,
    )
    .sort((a, b) => Math.abs(b.changeRate ?? 0) - Math.abs(a.changeRate ?? 0));

  result.moverCount = movers.length;

  if (movers.length === 0) return result;

  // #market-alerts
  const alertsUrl = process.env.DISCORD_WEBHOOK_ALERTS;
  if (alertsUrl) {
    try {
      const embed = buildMoversEmbed(movers, "all");
      await sendWebhook(alertsUrl, {
        username: "GCI Market Alert",
        embeds:   [embed],
      });
      result.alertsSent = true;
    } catch (err) {
      result.errors.push(`alerts: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // #rising-cards (gainers only)
  const risingUrl = process.env.DISCORD_WEBHOOK_RISING;
  if (risingUrl) {
    const gainers = movers.filter((e) => (e.changeRate ?? 0) > 0);
    if (gainers.length > 0) {
      try {
        const embed = buildMoversEmbed(gainers, "rising");
        await sendWebhook(risingUrl, {
          username: "GCI Rising Cards",
          embeds:   [embed],
        });
        result.risingSent = true;
      } catch (err) {
        result.errors.push(`rising: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return result;
}

/**
 * Post a cron-summary to #collector-log.
 * Fire-and-forget safe.
 */
export async function postCollectorLog(result: RecalcResult): Promise<void> {
  const logUrl = process.env.DISCORD_WEBHOOK_LOG;
  if (!logUrl) return;

  try {
    const embed = buildLogEmbed(result);
    await sendWebhook(logUrl, {
      username: "GCI Collector Log",
      embeds:   [embed],
    });
  } catch (err) {
    // Non-fatal — log to console only
    console.warn("[discordAlerts] postCollectorLog failed:", err instanceof Error ? err.message : err);
  }
}

/** Check which alert webhook env vars are configured. */
export function checkAlertEnv(): {
  alerts: boolean;
  rising: boolean;
  log:    boolean;
} {
  return {
    alerts: !!process.env.DISCORD_WEBHOOK_ALERTS,
    rising: !!process.env.DISCORD_WEBHOOK_RISING,
    log:    !!process.env.DISCORD_WEBHOOK_LOG,
  };
}
