"use server";

/**
 * recap.ts
 *
 * Daily Market Recap の集約レイヤー。
 * /daily ページ・OG 画像・将来の API / RSS / Bot から再利用。
 *
 * 設計方針:
 *   - 内部で getTrendingCards / getTopGainers / getTopLosers / getVolumeSpikes を呼ぶ
 *   - fetchCandidates は各関数が個別に呼ぶが、将来キャッシュ化しやすいよう recap.ts で
 *     並列実行にまとめる
 *   - editorNote は完全テンプレートベース（AI API 不要）
 */

import { getTrendingCards, getTopGainers, getTopLosers, getVolumeSpikes, type MarketCard } from "@/actions/market";
import { getLatestIndex, getPreviousDaySnapshot }                                          from "@/actions/index";
import { GAMES }                                                                           from "@/lib/seo/games";
import { prisma }                                                                          from "@/lib/prisma";
import type { IndexSnapshot }                                                              from "@/types";

// ----------------------------------------------------------------
// 型
// ----------------------------------------------------------------

export type IndexSummary = {
  value:      number;
  change24h:  number | null;   // % (null = 前日データなし)
  changeRate: number;          // 直前計算との比率（IndexValue.changeRate）
  updatedAt:  string;
};

export type DailyRecap = {
  date:        string;          // "2026-05-09"
  generatedAt: string;          // ISO
  index:       IndexSummary | null;
  gainers:     MarketCard[];    // top 5
  losers:      MarketCard[];    // top 5
  spikes:      MarketCard[];    // top 5
  trending:    MarketCard[];    // top 5
  editorNote:  string;
};

// ----------------------------------------------------------------
// Editor Note テンプレートジェネレーター
//
// データドリブンな"市況コメント"。
// AI API なしで自然に読めるテキストを生成する。
// ----------------------------------------------------------------

function generateEditorNote(data: {
  index:    IndexSummary | null;
  gainers:  MarketCard[];
  losers:   MarketCard[];
  spikes:   MarketCard[];
}): string {
  const { index, gainers, losers, spikes } = data;
  const sentences: string[] = [];

  // ── 1. 指数コメント ──────────────────────────────────────────
  if (index !== null) {
    const dir      = index.change24h !== null
      ? (index.change24h > 0.5  ? "上昇基調"  :
         index.change24h < -0.5 ? "下落基調"  : "横ばい")
      : (index.changeRate > 0   ? "上昇"      :
         index.changeRate < 0   ? "下落"      : "横ばい");
    const rateStr  = index.change24h !== null
      ? `${index.change24h > 0 ? "+" : ""}${index.change24h.toFixed(2)}%`
      : `${index.changeRate > 0 ? "+" : ""}${index.changeRate.toFixed(2)}%`;
    sentences.push(`GCI 総合指数は前日比 ${rateStr} で${dir}。`);
  }

  // ── 2. 市場全体の温度感 ─────────────────────────────────────
  const total = gainers.length + losers.length;
  if (total > 0) {
    const bullish = gainers.length > losers.length;
    const balance = `${gainers.length} 銘柄高騰 · ${losers.length} 銘柄下落`;
    sentences.push(
      bullish
        ? `市場は強気優勢（${balance}）。`
        : gainers.length === losers.length
        ? `市場は均衡（${balance}）。`
        : `市場は軟調（${balance}）。`
    );
  }

  // ── 3. ゲーム別高騰ランキング ───────────────────────────────
  const gameCounts = new Map<string, number>();
  for (const c of gainers) {
    if (c.game) gameCounts.set(c.game, (gameCounts.get(c.game) ?? 0) + 1);
  }
  const topGameEntry = [...gameCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topGameEntry) {
    const gameCfg  = GAMES.find((g) => g.slug === topGameEntry[0]);
    const gameName = gameCfg?.nameJa ?? topGameEntry[0];
    sentences.push(
      `${gameName}が高騰銘柄の ${topGameEntry[1]}/${gainers.length} 枚を占め最も活発。`
    );
  }

  // ── 4. トップ高騰カード ─────────────────────────────────────
  if (gainers.length > 0) {
    const top = gainers[0];
    const pct = top.change7d !== null ? `+${top.change7d.toFixed(1)}%` : "";
    sentences.push(`最大騰落は「${top.cardName}」（${top.setName}）${pct}。`);
  }

  // ── 5. ボリュームスパイク ───────────────────────────────────
  if (spikes.length > 0) {
    const sp = spikes[0];
    sentences.push(
      `出品量スパイクは ${spikes.length} 件検知。`
      + `「${sp.cardName}」が 24h ${sp.count24h} 件と週次平均の `
      + `${(sp.count24h / Math.max(sp.count7d / 7, 1)).toFixed(1)} 倍に急増。`
    );
  } else {
    sentences.push("本日は大きな出品量スパイクは検知されなかった。");
  }

  return sentences.join(" ");
}

// ----------------------------------------------------------------
// getDailyRecap — メイン関数
// ----------------------------------------------------------------

export async function getDailyRecap(): Promise<DailyRecap> {
  const now  = new Date();
  const date = now.toLocaleDateString("sv-SE"); // "2026-05-09" (ISO 8601 形式)

  // 全データを並列取得（market の fetchCandidates が内部で4クエリ×4回走るが
  // /daily は ISR 1時間キャッシュなので実用上問題なし）
  const [latestIdx, prevIdx, gainers, losers, spikes, trending] = await Promise.all([
    getLatestIndex(),
    getPreviousDaySnapshot(),
    getTopGainers(5),
    getTopLosers(5),
    getVolumeSpikes(5),
    getTrendingCards(5),
  ]);

  // 指数 24h 変動率
  let index: IndexSummary | null = null;
  if (latestIdx) {
    const change24h =
      prevIdx && prevIdx.value > 0
        ? ((latestIdx.value - prevIdx.value) / prevIdx.value) * 100
        : null;
    index = {
      value:      latestIdx.value,
      change24h,
      changeRate: latestIdx.changeRate,
      updatedAt:  latestIdx.calculatedAt,
    };
  }

  const editorNote = generateEditorNote({ index, gainers, losers, spikes });

  return {
    date,
    generatedAt: now.toISOString(),
    index,
    gainers,
    losers,
    spikes,
    trending,
    editorNote,
  };
}

// ----------------------------------------------------------------
// DB 永続化
// ----------------------------------------------------------------

/**
 * DailyRecap を DB に保存（upsert）。
 * 同一 date が存在する場合は上書き（再生成を許容する）。
 */
export async function saveDailyRecap(recap: DailyRecap): Promise<void> {
  await prisma.dailyRecapSnapshot.upsert({
    where:  { date: recap.date },
    create: { date: recap.date, payload: recap as unknown as object },
    update: { payload: recap as unknown as object, generatedAt: new Date() },
  });
}

/**
 * date 文字列（"2026-05-09"）で DB から recap を取得。
 * 見つからなければ null。
 */
export async function getDailyRecapByDate(date: string): Promise<DailyRecap | null> {
  const row = await prisma.dailyRecapSnapshot.findUnique({
    where: { date },
  });
  if (!row) return null;
  return row.payload as unknown as DailyRecap;
}

/**
 * 最近の recap 日付一覧（新しい順）。
 * アーカイブページの一覧 & generateStaticParams で使用。
 */
export async function getRecentRecapDates(limit = 90): Promise<string[]> {
  const rows = await prisma.dailyRecapSnapshot.findMany({
    orderBy: { date: "desc" },
    take:    limit,
    select:  { date: true },
  });
  return rows.map((r) => r.date);
}

/**
 * X 投稿結果を DB に記録（idempotency guard）。
 * tweetId が既に存在する日付への再投稿を検知するために使用。
 */
export async function saveTweetResult(
  date:     string,
  tweetId:  string,
  tweetUrl: string,
): Promise<void> {
  await prisma.dailyRecapSnapshot.update({
    where:  { date },
    data:   { tweetId, tweetUrl, tweetedAt: new Date() },
  });
}

/**
 * 指定日のスナップショットに tweetId があれば返す（重複投稿防止チェック）。
 */
export async function getSnapshotTweetStatus(date: string): Promise<{
  hasTweet: boolean;
  tweetId:  string | null;
  tweetUrl: string | null;
} | null> {
  const row = await prisma.dailyRecapSnapshot.findUnique({
    where:  { date },
    select: { tweetId: true, tweetUrl: true },
  });
  if (!row) return null;
  return {
    hasTweet: row.tweetId !== null,
    tweetId:  row.tweetId,
    tweetUrl: row.tweetUrl,
  };
}

/**
 * Discord 投稿結果を DB に記録（idempotency guard）。
 */
export async function saveDiscordResult(
  date:      string,
  messageId: string,
): Promise<void> {
  await prisma.dailyRecapSnapshot.update({
    where: { date },
    data:  { discordMessageId: messageId, discordPostedAt: new Date() },
  });
}

/**
 * 指定日のスナップショットに discordMessageId があれば返す（重複投稿防止チェック）。
 */
export async function getSnapshotDiscordStatus(date: string): Promise<{
  hasPost:   boolean;
  messageId: string | null;
} | null> {
  const row = await prisma.dailyRecapSnapshot.findUnique({
    where:  { date },
    select: { discordMessageId: true },
  });
  if (!row) return null;
  return {
    hasPost:   row.discordMessageId !== null,
    messageId: row.discordMessageId,
  };
}

// ----------------------------------------------------------------
// Admin: Distribution Logs
// ----------------------------------------------------------------

export type DistributionLogRow = {
  date:              string;
  generatedAt:       string;   // ISO
  // X
  tweetId:           string | null;
  tweetedAt:         string | null;  // ISO
  tweetUrl:          string | null;
  // Discord
  discordMessageId:  string | null;
  discordPostedAt:   string | null;  // ISO
};

/**
 * 配信ログ一覧（Admin 用）。
 * 最新 limit 件の DailyRecapSnapshot を返す。
 */
export async function getDistributionLogs(
  limit = 60,
): Promise<DistributionLogRow[]> {
  const rows = await prisma.dailyRecapSnapshot.findMany({
    orderBy: { date: "desc" },
    take:    limit,
    select: {
      date:             true,
      generatedAt:      true,
      tweetId:          true,
      tweetedAt:        true,
      tweetUrl:         true,
      discordMessageId: true,
      discordPostedAt:  true,
    },
  });

  return rows.map((r) => ({
    date:             r.date,
    generatedAt:      r.generatedAt.toISOString(),
    tweetId:          r.tweetId,
    tweetedAt:        r.tweetedAt?.toISOString() ?? null,
    tweetUrl:         r.tweetUrl,
    discordMessageId: r.discordMessageId,
    discordPostedAt:  r.discordPostedAt?.toISOString() ?? null,
  }));
}
