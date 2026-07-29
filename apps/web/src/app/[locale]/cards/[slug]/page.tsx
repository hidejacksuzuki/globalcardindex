import type { Metadata }        from "next";
import { notFound }              from "next/navigation";
import Link                      from "next/link";
import { getCardBySlug, getCardPriceHistory, getCardEngagement } from "@gci/core";
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
import { ListingPhotoStrip }     from "@/components/cards/ListingPhotoStrip";
import { getCardListingPhotos }  from "@gci/core";
import { isInPortfolio }         from "@gci/core";
import { auth }                  from "@/auth";
import { safeJsonLd }            from "@/lib/jsonLd";
import { getServerTranslations, getLocale } from "@/i18n/server";
import type { Translations }     from "@/i18n";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = "https://gci-index.com";

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

  const locale = getLocale();
  const t      = getServerTranslations().cardDetail;

  const priceStr = card.latestPrice !== null && card.currency
    ? ` — ${t.metaPriceLabel} ${formatPrice(card.latestPrice, card.currency)}`
    : "";

  const title       = `${card.name} (${card.setName}) ${t.metaTitleSuffix}${priceStr} | Global Card Index`;
  const description = `${card.name} ${card.rarity} · ${card.condition}${t.metaDescription
    .replace("{set}", card.setName)
    .replace("{count}", String(card.priceCount))}`;

  const jaUrl = `${SITE_ORIGIN}/cards/${card.slug}`;
  const enUrl = `${SITE_ORIGIN}/en/cards/${card.slug}`;
  const url   = locale === "en" ? enUrl : jaUrl;

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
    alternates: {
      canonical: url,
      languages: { ja: jaUrl, en: enUrl, "x-default": jaUrl },
    },
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

  const t    = getServerTranslations().cardDetail;
  const game = card.game ? getGame(card.game) : null;

  // JSON-LD の URL は generateMetadata の canonical と一致させる（ロケール別）
  const canonicalUrl = getLocale() === "en"
    ? `${SITE_ORIGIN}/en/cards/${card.slug}`
    : `${SITE_ORIGIN}/cards/${card.slug}`;

  // セッション取得 — ログイン済みなら DB watchlist で確認、匿名なら cookie で確認
  const session  = await auth();
  const userId   = session?.user?.id ?? null;
  const watchedById = userId
    ? await isUserWatching(userId, card.id).catch(() => false)
    : await isWatching(card.id).catch(() => false);

  const portfolioStatus = userId
    ? await isInPortfolio(userId, card.id).catch(() => ({ inPortfolio: false as const }))
    : { inPortfolio: false as const };

  // 価格推移・熱量・per-card index value・出品写真（並列取得）
  const [priceHistory, engagement, listingPhotos, cardIndex] = await Promise.all([
    getCardPriceHistory(card.id, 90).catch(() => []),
    getCardEngagement(card.id).catch(() => ({ watchers: 0, holders: 0, recentSales: [] })),
    getCardListingPhotos(card.id).catch(() => []),
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
            label={t.statLatestPrice}
            value={
              card.latestPrice !== null && card.currency
                ? formatPrice(card.latestPrice, card.currency)
                : "—"
            }
          />
          <Stat
            label={t.statChange7d}
            value={card.change7d !== null ? `${card.change7d > 0 ? "+" : ""}${card.change7d.toFixed(1)}%` : "—"}
            colorClass={
              card.change7d === null ? "text-navy" :
              card.change7d > 0 ? "text-gold-700" : card.change7d < 0 ? "text-red-600" : "text-navy"
            }
          />
          <Stat
            label={t.statChange30d}
            value={card.change30d !== null ? `${card.change30d > 0 ? "+" : ""}${card.change30d.toFixed(1)}%` : "—"}
            colorClass={
              card.change30d === null ? "text-navy" :
              card.change30d > 0 ? "text-gold-700" : card.change30d < 0 ? "text-red-600" : "text-navy"
            }
          />
          <Stat label={t.statObservations} value={card.priceCount.toLocaleString()} />
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
              <span>{t.loginToAdd}</span>
            </Link>
          )}
        </div>
      </header>

      {/* 価格データ未収集カードの空状態（行き止まり回避） */}
      {card.priceCount === 0 && (
        <section className="border border-navy/10 bg-white p-8 text-center space-y-4">
          <p className="text-3xl">📊</p>
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy">{t.emptyTitle}</p>
            <p className="text-xs text-navy/50 leading-relaxed">
              {t.emptyBody1}<br />
              {t.emptyBody2}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
            <Link
              href={`/sets/${encodeURIComponent(card.setName)}`}
              className="border border-navy/20 px-4 py-2 text-xs text-navy/70 hover:border-navy hover:text-navy transition"
            >
              {card.setName} {t.emptyOtherCards}
            </Link>
            <Link
              href="/cards"
              className="border border-navy/20 px-4 py-2 text-xs text-navy/70 hover:border-navy hover:text-navy transition"
            >
              {t.emptyBrowseCards}
            </Link>
          </div>
        </section>
      )}

      {/* 実際の出品写真（出品者提供画像・ホットリンク表示） */}
      <ListingPhotoStrip photos={listingPhotos} />

      {/* GCI Price Confidence — 推定相場と、その信頼性を一緒に示す */}
      {card.priceCount > 0 && card.currency && (
        <section className="border border-navy/10 bg-white p-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-3">
              <h2
                title={t.estTooltip}
                className="text-xs uppercase tracking-widest text-navy/50 cursor-help"
              >
                {t.estTitle}
              </h2>
              {cardIndex?.confidence && (
                <ConfidenceBadge confidence={cardIndex.confidence} t={t} />
              )}
            </div>
            {/* 熱量バッジ */}
            <div className="flex items-center gap-3 text-[11px] text-navy/45">
              {engagement.watchers > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span>☆</span>{engagement.watchers}{t.estWatchers}
                </span>
              )}
              {engagement.holders > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span>🗂</span>{engagement.holders}{t.estHolders}
                </span>
              )}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/40">{t.estMin}</dt>
              <dd className="mt-1 text-lg tabular-nums text-navy">
                {card.minPrice !== null ? formatPrice(card.minPrice, card.currency) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/40">{t.estMedian}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-navy">
                {card.medianPrice !== null ? formatPrice(card.medianPrice, card.currency) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/40">{t.estMax}</dt>
              <dd className="mt-1 text-lg tabular-nums text-navy">
                {card.maxPrice !== null ? formatPrice(card.maxPrice, card.currency) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/40">{t.estCount}</dt>
              <dd className="mt-1 text-lg tabular-nums text-navy/60">
                {card.priceCount.toLocaleString()}{t.estCountUnit && ` ${t.estCountUnit}`}
              </dd>
            </div>
          </dl>
          {/* データの鮮度と算出方法の注記（信頼性の要約は上の信頼度バッジに一本化） */}
          <div className="mt-4 border-t border-navy/5 pt-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 text-[11px] text-navy/50">
              {card.lastObservedAt && (
                <span>{t.estUpdated}: {relativeTime(card.lastObservedAt, t)}</span>
              )}
            </div>
            <p className="text-[11px] text-navy/35">
              {t.estMethodNote}
            </p>
          </div>
        </section>
      )}

      {/* 直近の取引・価格観測 */}
      {engagement.recentSales.length > 0 && card.currency && (
        <section className="border border-navy/10 bg-white p-6">
          <h2 className="text-xs uppercase tracking-widest text-navy/50 mb-4">{t.recentTitle}</h2>
          <ul className="divide-y divide-navy/5">
            {engagement.recentSales.map((s, i) => (
              <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-navy/50 text-xs">{relativeTime(s.observedAt, t)}</span>
                <span className="inline-flex items-center gap-2">
                  {s.sold ? (
                    <span className="rounded bg-green-50 border border-green-200 px-1.5 py-0.5 text-[10px] text-green-700">{t.recentSold}</span>
                  ) : (
                    <span className="rounded bg-navy/5 border border-navy/10 px-1.5 py-0.5 text-[10px] text-navy/50">{t.recentObserved}</span>
                  )}
                  <span className="tabular-nums font-medium text-navy">{formatPrice(s.price, s.currency)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 価格推移チャート */}
      {priceHistory.length >= 2 && (
        <section className="border border-navy/10 bg-white p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs uppercase tracking-widest text-navy/50">{t.chartTitle}</h2>
            <Link
              href={`/cards/${card.id}/history`}
              className="text-[11px] text-navy/40 hover:text-navy transition underline underline-offset-2"
            >
              {t.chartAllHistory}
            </Link>
          </div>
          <PriceChart points={priceHistory} />
        </section>
      )}

      {/* Card Index — 補助情報 */}
      {showIndex && cardIndex && (
        <section className="border border-navy/10 bg-white p-6">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xs uppercase tracking-widest text-navy/50">{t.indexTitle}</h2>
            {isLowConf && (
              <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 border border-red-200">
                {t.indexReference}
              </span>
            )}
            {isMedConf && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 border border-amber-200">
                {t.indexReference}
              </span>
            )}
          </div>
          <p className="mb-4 text-[11px] text-navy/40 leading-relaxed">
            {t.indexNote}
          </p>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <dt
                title={t.indexValueTooltip}
                className="text-xs uppercase tracking-widest text-navy/50 cursor-help"
              >
                {t.indexValue}
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-navy">
                {cardIndex.value.toFixed(1)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/50">{t.indexChange}</dt>
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
              <dt className="text-xs uppercase tracking-widest text-navy/50">{t.indexSamples}</dt>
              <dd className="mt-1 text-lg tabular-nums text-navy/60">
                {cardIndex.sampleCount ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/50">{t.indexConfidence}</dt>
              <dd className="mt-1">
                <ConfidenceBadge confidence={cardIndex.confidence} t={t} />
              </dd>
            </div>
          </dl>
          {(isLowConf || isMedConf) && (
            <p className="mt-4 text-[11px] text-navy/40 border-t border-navy/5 pt-3">
              {t.indexLowDataNote}
            </p>
          )}
        </section>
      )}

      {/* Retention CTA — Newsletter はβ期間は非表示。カードリクエストのみ表示 */}
      <div>
        {/* Card request */}
        <div className="rounded border border-navy/10 bg-white p-5 flex flex-col gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-navy/40">{t.requestLabel}</p>
            <p className="mt-1 text-sm font-medium text-navy">{t.requestTitle}</p>
            <p className="mt-0.5 text-xs text-navy/50">
              {t.requestBody}
            </p>
          </div>
          <CardRequestButton className="self-start" />
        </div>
      </div>

      {/*
        JSON-LD — 相場データを表す Product。
        注意:
          - GCI はカードを販売していないため availability(InStock) は出さない。
            実際に在庫を持つ販売者ではないのに在庫ありと宣言するのは誤情報になる。
          - review / aggregateRating は実体（レビュー・評価）を持たないため出さない。
            Search Console が「推奨項目なし」と警告するが、存在しない評価を
            マークアップする方がガイドライン違反として遥かに重い。
          - 価格は単一の Offer ではなく、収集済みの最安値〜最高値と観測件数を
            AggregateOffer で表現する（実データに忠実かつリッチな表現）。
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type":    "Product",
            name:       card.name,
            description: `${card.name} ${card.rarity} · ${card.condition} — ${card.setName}`,
            url:        canonicalUrl,
            ...(card.minPrice !== null && card.maxPrice !== null && card.currency
              ? {
                  offers: {
                    "@type":       "AggregateOffer",
                    priceCurrency: card.currency,
                    lowPrice:      card.minPrice.toFixed(0),
                    highPrice:     card.maxPrice.toFixed(0),
                    offerCount:    card.priceCount,
                    url:           canonicalUrl,
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

type CardDetailT = Translations["cardDetail"];

function relativeTime(iso: string, t: CardDetailT): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min    = Math.floor(diffMs / 60_000);
  if (min < 60)      return `${Math.max(min, 1)}${t.timeMinutesAgo}`;
  const hours = Math.floor(min / 60);
  if (hours < 24)    return `${hours}${t.timeHoursAgo}`;
  const days = Math.floor(hours / 24);
  if (days < 30)     return `${days}${t.timeDaysAgo}`;
  return `${Math.floor(days / 30)}${t.timeMonthsAgo}`;
}

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

function ConfidenceBadge({ confidence, t }: { confidence: string | null; t: CardDetailT }) {
  if (!confidence) return <span className="text-sm text-navy/30">—</span>;
  const tooltips: Record<string, string> = {
    HIGH: t.confHigh,
    MED:  t.confMed,
    LOW:  t.confLow,
  };
  const styles: Record<string, string> = {
    HIGH: "bg-green-100 text-green-700",
    MED:  "bg-amber-100 text-amber-700",
    LOW:  "bg-red-100   text-red-700",
  };
  return (
    <span
      title={tooltips[confidence] ?? t.confFallback}
      className={`inline-block cursor-help rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles[confidence] ?? "bg-navy/10 text-navy/50"}`}
    >
      {confidence}
    </span>
  );
}
