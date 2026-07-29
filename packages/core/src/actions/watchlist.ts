"use server";

import { cookies }        from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma }         from "@gci/db";
import { TRUST_THRESHOLD } from "./_helpers";

// ----------------------------------------------------------------
// Session cookie
// ----------------------------------------------------------------

const SESSION_COOKIE   = "gci_session";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Cookie から sessionId を取得し、なければ新規発行。
 * Watchlist レコードも upsert で保証する。
 * ※ cookies().set() は Server Action 内でのみ動作する。
 */
async function getOrCreateWatchlist(): Promise<string> {
  const cookieStore = cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    cookieStore.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   ONE_YEAR_SECONDS,
      path:     "/",
    });
  }

  const watchlist = await prisma.watchlist.upsert({
    where:  { sessionId },
    create: { sessionId },
    update: {},
  });

  return watchlist.id;
}

/** Cookie のみ読む（Server Component から安全に呼べる） */
export async function getSessionWatchlistId(): Promise<string | null> {
  const cookieStore = cookies();
  const sessionId   = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const watchlist = await prisma.watchlist.findUnique({ where: { sessionId } });
  return watchlist?.id ?? null;
}

// ----------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------

export async function addToWatchlist(cardId: string): Promise<void> {
  const watchlistId = await getOrCreateWatchlist();

  await prisma.watchlistItem.upsert({
    where:  { watchlistId_cardId: { watchlistId, cardId } },
    create: { watchlistId, cardId },
    update: {},
  });

  revalidatePath("/watchlist");
  revalidatePath(`/cards/${cardId}`);
}

export async function removeFromWatchlist(cardId: string): Promise<void> {
  const cookieStore = cookies();
  const sessionId   = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return;

  const watchlist = await prisma.watchlist.findUnique({ where: { sessionId } });
  if (!watchlist) return;

  await prisma.watchlistItem.deleteMany({
    where: { watchlistId: watchlist.id, cardId },
  });

  revalidatePath("/watchlist");
  revalidatePath(`/cards/${cardId}`);
}

// ----------------------------------------------------------------
// Queries
// ----------------------------------------------------------------

export async function isWatching(cardId: string): Promise<boolean> {
  const cookieStore = cookies();
  const sessionId   = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return false;

  const item = await prisma.watchlistItem.findFirst({
    where: { watchlist: { sessionId }, cardId },
  });
  return item !== null;
}

// ----------------------------------------------------------------
// Price signals
// ----------------------------------------------------------------

export type SignalType = "up" | "down" | "new_high" | "new_low" | "volume_spike";

export type PriceSignal = {
  type:    SignalType;
  label:   string;   // 表示テキスト  e.g. "+14.2%"
  detail?: string;   // サブテキスト
};

export type WatchlistCard = {
  cardId:       string;
  cardName:     string;
  setName:      string;
  rarity:       string;
  condition:    string;
  addedAt:      Date;
  latestPrice:  number | null;
  currency:     string | null;
  change7d:     number | null;  // % (nullable = no old data)
  change7dAbs:  number | null;  // 絶対値
  signals:      PriceSignal[];
};

// ── シグナルしきい値（運用しながら調整する定数群） ──────────────────
//
// 価格変動
const SIGNAL_THRESHOLD_UP     =  10;  // 7d 上昇率 (%) がこれ以上で "up"
const SIGNAL_THRESHOLD_DOWN   = -10;  // 7d 下落率 (%) がこれ以下で "down"
//
// ボリュームスパイク
// 誤爆防止のため 3 条件すべて満たす場合のみ発火:
//   1. 7d 合計件数 >= MIN_7D  → データが少ない初期段階では発火しない
//   2. 24h 件数    >= MIN_24H → 単発出品でも発火しない
//   3. 24h >= 7d 日次平均 × MULTIPLIER
const VOLUME_SPIKE_MIN_7D     = 10;   // 7d 合計の最低母数（初期誤爆防止）
const VOLUME_SPIKE_MIN_24H    = 3;    // 24h 件数の最低数
const VOLUME_SPIKE_MULTIPLIER = 3.0;  // 日次平均の何倍でスパイク判定

async function computeSignals(cardId: string): Promise<{
  latestPrice:  number | null;
  currency:     string | null;
  change7d:     number | null;
  change7dAbs:  number | null;
  signals:      PriceSignal[];
}> {
  const now   = new Date();
  const ago7d = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const ago24h = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  const activeWhere = {
    cardId,
    isOutlier:  false,
    // stale(収集停止)でも最後の既知価格は表示する。指数計算のみ除外する（indexCalculator）。
    trustScore: { gte: TRUST_THRESHOLD },
  };

  const [
    latestRaw,
    oldRaw,
    maxRaw,
    minRaw,
    count24h,
    count7d,
  ] = await Promise.all([
    // 最新価格
    prisma.price.findFirst({
      where:   activeWhere,
      orderBy: { observedAt: "desc" },
      select:  { price: true, currency: true, observedAt: true },
    }),
    // 7日前の価格（7d前以前で最新）
    prisma.price.findFirst({
      where:   { ...activeWhere, observedAt: { lte: ago7d } },
      orderBy: { observedAt: "desc" },
      select:  { price: true },
    }),
    // 過去最高値
    prisma.price.aggregate({
      where:   { cardId, isOutlier: false },
      _max:    { price: true },
    }),
    // 過去最安値
    prisma.price.aggregate({
      where:   { cardId, isOutlier: false },
      _min:    { price: true },
    }),
    // 24h の価格観測数
    prisma.price.count({
      where: { cardId, capturedAt: { gte: ago24h } },
    }),
    // 7d の価格観測数（日次平均算出用）
    prisma.price.count({
      where: { cardId, capturedAt: { gte: ago7d } },
    }),
  ]);

  const latestPrice = latestRaw?.price    ?? null;
  const currency    = latestRaw?.currency ?? null;
  const oldPrice    = oldRaw?.price       ?? null;
  const allTimeMax  = maxRaw._max.price   ?? null;
  const allTimeMin  = minRaw._min.price   ?? null;

  // 変動率計算
  let change7d:    number | null = null;
  let change7dAbs: number | null = null;
  if (latestPrice !== null && oldPrice !== null && oldPrice > 0) {
    change7dAbs = latestPrice - oldPrice;
    change7d    = (change7dAbs / oldPrice) * 100;
  }

  const signals: PriceSignal[] = [];

  // ▲▼ 価格変動シグナル
  if (change7d !== null && change7dAbs !== null) {
    if (change7d >= SIGNAL_THRESHOLD_UP) {
      signals.push({
        type:  "up",
        label: `+${change7d.toFixed(1)}%`,
        detail: `7d: +¥${Math.round(change7dAbs).toLocaleString()}`,
      });
    } else if (change7d <= SIGNAL_THRESHOLD_DOWN) {
      signals.push({
        type:  "down",
        label: `${change7d.toFixed(1)}%`,
        detail: `7d: -¥${Math.abs(Math.round(change7dAbs)).toLocaleString()}`,
      });
    }
  }

  // ★ 過去最高値更新
  if (
    latestPrice !== null &&
    allTimeMax  !== null &&
    latestPrice >= allTimeMax &&
    (latestRaw?.observedAt ?? new Date(0)) > ago7d  // 最近観測されたもの限定
  ) {
    signals.push({
      type:  "new_high",
      label: "New High",
      detail: `¥${Math.round(latestPrice).toLocaleString()}`,
    });
  }

  // ▼ 過去最安値更新
  if (
    latestPrice !== null &&
    allTimeMin  !== null &&
    latestPrice <= allTimeMin &&
    (latestRaw?.observedAt ?? new Date(0)) > ago7d
  ) {
    signals.push({
      type:  "new_low",
      label: "New Low",
      detail: `¥${Math.round(latestPrice).toLocaleString()}`,
    });
  }

  // ⚡ ボリュームスパイク（出品数急増）
  const dailyAvg7d = count7d / 7;
  if (
    count7d  >= VOLUME_SPIKE_MIN_7D  &&     // 母数不足ガード（初期誤爆防止）
    count24h >= VOLUME_SPIKE_MIN_24H &&     // 単発出品ガード
    dailyAvg7d > 0                  &&
    count24h >= dailyAvg7d * VOLUME_SPIKE_MULTIPLIER
  ) {
    signals.push({
      type:  "volume_spike",
      label: `${count24h} listings`,
      detail: `vs ${dailyAvg7d.toFixed(1)}/day avg`,
    });
  }

  return { latestPrice, currency, change7d, change7dAbs, signals };
}

// ----------------------------------------------------------------
// getWatchlistCards  (/watchlist ページで使用)
// ----------------------------------------------------------------

export async function getWatchlistCards(): Promise<WatchlistCard[]> {
  const cookieStore = cookies();
  const sessionId   = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return [];

  const watchlist = await prisma.watchlist.findUnique({
    where:   { sessionId },
    include: {
      items: {
        orderBy: { addedAt: "desc" },
        include: { card: { select: { id: true, name: true, setName: true, rarity: true, condition: true } } },
      },
    },
  });

  if (!watchlist || watchlist.items.length === 0) return [];

  // 各カードのシグナルを並列計算
  const results = await Promise.all(
    watchlist.items.map(async (item) => {
      const signals = await computeSignals(item.cardId);
      return {
        cardId:      item.card.id,
        cardName:    item.card.name,
        setName:     item.card.setName,
        rarity:      item.card.rarity,
        condition:   item.card.condition,
        addedAt:     item.addedAt,
        ...signals,
      };
    }),
  );

  return results;
}
