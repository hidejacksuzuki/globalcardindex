import type { Metadata }        from "next";
import { notFound }              from "next/navigation";
import Link                      from "next/link";
import { getCardBySlug, getCardPriceHistory } from "@gci/core";
import { getGame }               from "@gci/core";
import { WatchButton }           from "@/components/watchlist/WatchButton";
import { isWatching, isUserWatching } from "@gci/core";
import { formatPrice }           from "@gci/core";
import { MIN_SAMPLES_DISPLAY }   from "@gci/core";
import { prisma }                from "@gci/db";
import { CardViewTracker }       from "@/components/analytics/CardViewTracker";
import { CardRequestButton }     from "@/components/cards/CardRequestButton";
import { AddToPortfolioButton }  from "@/components/portfolio/AddToPortfolioButton";
import { PriceChart }            from "@/components/cards/PriceChart";
import { isInPortfolio }         from "@gci/core";
import { auth }                  from "@/auth";

export const dynamic = "force-dynamic";

// ----------------------------------------------------------------
// Metadata
// ----------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const card = await getCardBySlug(params.slug);
  if (!card) return {};

  const priceStr = card.latestPrice !== null && card.currency
    ? ` 最新価格 ${formatPrice(card.latestPrice, card.currency)}`
    : "";

  const title       = `${card.name} (${card.setName}) 相場${priceStr} | Global Card Index`;
  const description = `${card.name} ${card.rarity}・${card.condition} の市場相場。${card.setName} 収録。${card.priceCount} 件の価格データから算出した最新値・変動率を掲載。`;
  const url         = `https://gci-index.com/cards/${card.slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Global Card Index",
      type:     "website",
    },
    twitter: {
      card:        "summary",
      title,
      description,
    },
    alternates: { canonical: url },
  };
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------
export default async function CardSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const card = await getCardBySlug(params.slug);
  if (!card) notFound();

  const game = card.game ? getGame(card.game) : null;

  // セッション取得 — ログイン済みなら DB watchlist で確認、匿名なら cookie で確認
  const session  = await auth();
  const userId   = session?.user?.id ?? null;
  const watchedById = userId
    ? await isUserWatching(userId, card.id).catch(() => false)
    : await isWatching(card.id).catch(() => false);

  const portfolioStatus = userId
    ? await isInPortfolio(userId, card.id).catch(() => ({ inPortfolio: false as const }))
    : { inPortfolio: false as const };

  // 価格推移・per-card index value（並列取得）
  const [priceHistory, cardIndex] = await Promise.all([
    getCardPriceHistory(card.id, 90).catch(() => []),
    prisma.indexValue.findFirst({
      where:   { cardId: card.id },
      orderBy: { calculatedAt: "desc" },
      select: {
        value:        true,
        changeRate:   true,
        sampleCount:  true,
        outlierCount: true,
        confidence:   true,
        calculatedAt: true,
      },
    }).catch(() => null),
  ]);

  // Show index only when we have sufficient data
  const showIndex     = cardIndex !== null && (cardIndex.sampleCount ?? 0) >= MIN_SAMPLES_DISPLAY;
  const isLowConf     = cardIndex?.confidence === "LOW";
  const isMedConf     = cardIndex?.confidence === "MED";

  return (
    <div className="space-y-8">
      {/* パンくず */}
      <nav className="flex items-center gap-2 text-xs uppercase tracking-widest text-navy/50">
        <Link href="/games" className="transition hover:text-navy">Games</Link>
        {game && (
          <>
            <span>/</span>
            <Link href={`/games/${game.slug}`} className="transition hover:text-navy">
              {game.name}
            </Link>
          </>
        )}
        <span>/</span>
        <Link
          href={`/sets/${encodeURIComponent(card.setName)}`}
          className="transition hover:text-navy"
        >
          {card.setName}
        </Link>
        <span>/</span>
        <span className="truncate max-w-[200px] text-navy/70">{card.name}</span>
      </nav>

      {/* カード詳細ヘッダー */}
      <header className="border border-navy/10 bg-white p-8">
        <p className="text-xs uppercase tracking-widest text-navy/50">{card.setName}</p>
        <h1 className="mt-2 text-3xl font-semibold text-navy">{card.name}</h1>
        <p className="mt-1 text-sm text-navy/60">
          {card.rarity} · {card.condition}
        </p>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <WatchButton cardId={card.id} slug={card.slug ?? card.id} isWatched={watchedById} userId={userId ?? undefined} />
        </div>
        <CardViewTracker slug={card.slug ?? card.id} />

        <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat
            label="最新価格"
            value={
              card.latestPrice !== null && card.currency
                ? formatPrice(card.latestPrice, card.currency)
                : "—"
            }
          />
          <Stat
            label="7日変動"
            value={card.change7d !== null ? `${card.change7d > 0 ? "+" : ""}${card.change7d.toFixed(1)}%` : "—"}
            colorClass={
              card.change7d === null ? "text-navy" :
              card.change7d > 0 ? "text-gold-700" : card.change7d < 0 ? "text-red-600" : "text-navy"
            }
          />
          <Stat
            label="30日変動"
            value={card.change30d !== null ? `${card.change30d > 0 ? "+" : ""}${card.change30d.toFixed(1)}%` : "—"}
            colorClass={
              card.change30d === null ? "text-navy" :
              card.change30d > 0 ? "text-gold-700" : card.change30d < 0 ? "text-red-600" : "text-navy"
            }
          />
          <Stat label="観測件数" value={card.priceCount.toLocaleString()} />
        </dl>

        {/* ── Portfolio CTA ───────────────────────── */}
        <div className="mt-6 border-t border-navy/5 pt-6">
          {userId ? (
            <AddToPortfolioButton
              cardId={card.id}
              cardName={card.name}
              userId={userId}
              initialItem={"portfolioCard" in portfolioStatus ? (portfolioStatus.portfolioCard ?? null) : null}
            />
          ) : (
            <Link
              href={`/login?callbackUrl=/cards/${card.slug ?? card.id}`}
              className="inline-flex items-center gap-1.5 border border-navy/20 px-3 py-1.5 text-xs uppercase tracking-widest text-navy/50 hover:border-navy hover:text-navy transition"
            >
              <span className="text-base leading-none">+</span>
              <span>ログインしてPortfolioに追加</span>
            </Link>
          )}
        </div>
      </header>

      {/* 推定相場 */}
      {card.priceCount > 0 && card.currency && (
        <section className="border border-navy/10 bg-white p-6">
          <h2 className="text-xs uppercase tracking-widest text-navy/50 mb-4">推定相場</h2>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/40">最安値</dt>
              <dd className="mt-1 text-lg tabular-nums text-navy">
                {card.minPrice !== null ? formatPrice(card.minPrice, card.currency) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/40">中央値</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-navy">
                {card.medianPrice !== null ? formatPrice(card.medianPrice, card.currency) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/40">最高値</dt>
              <dd className="mt-1 text-lg tabular-nums text-navy">
                {card.maxPrice !== null ? formatPrice(card.maxPrice, card.currency) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/40">サンプル数</dt>
              <dd className="mt-1 text-lg tabular-nums text-navy/60">
                {card.priceCount.toLocaleString()} 件
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[11px] text-navy/40 border-t border-navy/5 pt-3">
            ※ 直近60件の信頼スコア上位データから算出。外れ値・古いデータを除外済み。
          </p>
        </section>
      )}

      {/* 価格推移チャート */}
      {priceHistory.length >= 2 && (
        <section className="border border-navy/10 bg-white p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs uppercase tracking-widest text-navy/50">価格推移</h2>
            <Link
              href={`/cards/${card.id}/history`}
              className="text-[11px] text-navy/40 hover:text-navy transition underline underline-offset-2"
            >
              全履歴を見る →
            </Link>
          </div>
          <PriceChart points={priceHistory} />
        </section>
      )}

      {/* Card Index — 補助情報 */}
      {showIndex && cardIndex && (
        <section className="border border-navy/10 bg-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xs uppercase tracking-widest text-navy/50">Card Index</h2>
            {isLowConf && (
              <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 border border-red-200">
                参考値
              </span>
            )}
            {isMedConf && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 border border-amber-200">
                参考値
              </span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/50">指数値</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-navy">
                {cardIndex.value.toFixed(1)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/50">前回比</dt>
              <dd className={`mt-1 text-lg tabular-nums ${
                cardIndex.changeRate > 0 ? "text-gold-700" :
                cardIndex.changeRate < 0 ? "text-red-600" :
                "text-navy/40"
              }`}>
                {cardIndex.changeRate > 0 ? "▲" : cardIndex.changeRate < 0 ? "▼" : ""}
                {Math.abs(cardIndex.changeRate).toFixed(2)}%
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/50">サンプル数</dt>
              <dd className="mt-1 text-lg tabular-nums text-navy/60">
                {cardIndex.sampleCount ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/50">信頼度</dt>
              <dd className="mt-1">
                <ConfidenceBadge confidence={cardIndex.confidence} />
              </dd>
            </div>
          </dl>
          {(isLowConf || isMedConf) && (
            <p className="mt-4 text-[11px] text-navy/40 border-t border-navy/5 pt-3">
              ※ データ数が少ないため「参考値」として表示しています。精度向上のため価格データ収集を継続中です。
            </p>
          )}
        </section>
      )}

      {/* 内部リンク: 価格履歴ページへ */}
      {/* Retention CTA */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Newsletter nudge */}
        <div className="rounded border border-navy/10 bg-white p-5 flex flex-col gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-navy/40">アラート通知</p>
            <p className="mt-1 text-sm font-medium text-navy">価格変動をメールで受け取る</p>
            <p className="mt-0.5 text-xs text-navy/50">
              15%以上の変動があった週に自動アラートを配信します。
            </p>
          </div>
          <Link
            href="/newsletter"
            className="inline-flex items-center gap-1.5 rounded border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy/70 transition hover:border-navy hover:text-navy self-start"
          >
            Newsletter 登録 →
          </Link>
        </div>

        {/* Card request */}
        <div className="rounded border border-navy/10 bg-white p-5 flex flex-col gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-navy/40">カードリクエスト</p>
            <p className="mt-1 text-sm font-medium text-navy">追跡してほしいカードがある？</p>
            <p className="mt-0.5 text-xs text-navy/50">
              別バージョン・他ゲームのカードもリクエストできます。
            </p>
          </div>
          <CardRequestButton className="self-start" />
        </div>
      </div>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type":    "Product",
            name:       card.name,
            description: `${card.name} ${card.rarity}・${card.condition} — ${card.setName}`,
            url:        `https://gci-index.com/cards/${card.slug}`,
            ...(card.latestPrice !== null && card.currency
              ? {
                  offers: {
                    "@type":         "Offer",
                    priceCurrency:   card.currency,
                    price:           card.latestPrice.toFixed(0),
                    availability:    "https://schema.org/InStock",
                    url:             `https://gci-index.com/cards/${card.slug}`,
                  },
                }
              : {}),
          }),
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------
// Sub components
// ----------------------------------------------------------------

function Stat({
  label,
  value,
  colorClass = "text-navy",
}: {
  label:       string;
  value:       string;
  colorClass?: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-navy/50">{label}</dt>
      <dd className={`mt-1 text-lg tabular-nums ${colorClass}`}>{value}</dd>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return <span className="text-sm text-navy/30">—</span>;
  const styles: Record<string, string> = {
    HIGH: "bg-green-100 text-green-700",
    MED:  "bg-amber-100 text-amber-700",
    LOW:  "bg-red-100   text-red-700",
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles[confidence] ?? "bg-navy/10 text-navy/50"}`}>
      {confidence}
    </span>
  );
}
