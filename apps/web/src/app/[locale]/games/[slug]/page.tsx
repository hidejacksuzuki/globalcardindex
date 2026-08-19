import type { Metadata }   from "next";
import { notFound }         from "next/navigation";
import Link                 from "next/link";
import { unstable_cache }   from "next/cache";
import { getGame } from "@gci/core";
import { getGameStats }     from "@gci/core";
import { getGameIndex }     from "@gci/core";
import { getMarketboard }   from "@gci/core";
import { getCardThumbnails } from "@gci/core";
import { formatPrice }      from "@gci/core";
import type { MarketboardRow } from "@gci/core";
import { MarketTable }      from "@/components/market/MarketTable";
import { PriceCell }        from "@/components/market/PriceCell";
import { Disclaimer }       from "@/components/common/Disclaimer";
import { getTranslations }  from "@/i18n";
import type { Locale }      from "@/i18n/config";
import { safeJsonLd }            from "@/lib/jsonLd";

// 障害修正 (2026-07-31): 以前は revalidate=3600 の ISR にしていたが、
// [locale] レイアウトが cookies()（ロケール・認証）を読むため、本番の
// オンデマンド静的生成が DYNAMIC_SERVER_USAGE で必ず 500 になっていた。
// ページは動的レンダリングとし、データ取得を unstable_cache でキャッシュする。
export const dynamic = "force-dynamic";

/**
 * ゲームハブのページデータを10分キャッシュ。
 * 指数（オンザフライ計算）・ゲーム別マーケットボード・セット統計・サムネイルを
 * まとめて取得する。ゲーム別ハブ v1 (2026-08): 各ゲームを「サイト内サイト」として
 * 完結させ、統合(GCI)はゲーム別指数の束として意味を持たせる方針。
 */
const getGameHubData = unstable_cache(
  async (slug: string) => {
    const [stats, gameIndex, rows] = await Promise.all([
      getGameStats(slug).catch(() => null),
      getGameIndex(slug).catch(() => null),
      getMarketboard({ game: slug }).catch(() => [] as MarketboardRow[]),
    ]);
    // 騰落: 30日変動が計算できているカードのみ対象
    const withChange = rows.filter((r) => r.changeRate !== null && r.latestPrice !== null);
    const gainers = [...withChange].sort((a, b) => (b.changeRate! - a.changeRate!)).slice(0, 5)
      .filter((r) => r.changeRate! > 0);
    const losers  = [...withChange].sort((a, b) => (a.changeRate! - b.changeRate!)).slice(0, 5)
      .filter((r) => r.changeRate! < 0);
    const thumbs  = await getCardThumbnails(rows.slice(0, 120).map((r) => r.cardId)).catch(() => ({}));
    return { stats, gameIndex, rows, gainers, losers, thumbs };
  },
  ["game-hub-data"],
  { revalidate: 600 },
);

const SITE_ORIGIN = "https://www.gci-index.com";

// ----------------------------------------------------------------
// Metadata
// ----------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: { locale: Locale; slug: string };
}): Promise<Metadata> {
  const game = getGame(params.slug);
  if (!game) return {};
  const isEn = params.locale === "en";

  const title = isEn
    ? `${game.name} Price Index & Market Guide | Global Card Index`
    : `${game.nameJa} 相場・価格指数 | Global Card Index`;
  const description = isEn ? game.descriptionEn : game.description;

  const jaUrl = `${SITE_ORIGIN}/games/${game.slug}`;
  const enUrl = `${SITE_ORIGIN}/en/games/${game.slug}`;
  const url   = isEn ? enUrl : jaUrl;
  // metadata route は非 locale ツリー（app/games/[slug]/opengraph-image.tsx）で
  // 配信されるため URL を明示する（middleware がバイパスして到達させる）
  const ogImage = `${SITE_ORIGIN}/games/${game.slug}/opengraph-image`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Global Card Index",
      type:     "website",
      images:   [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description,
      images:      [ogImage],
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
export default async function GamePage({
  params,
}: {
  params: { locale: Locale; slug: string };
}) {
  const game  = getGame(params.slug);
  if (!game) notFound();

  const t    = getTranslations(params.locale);
  const h    = t.gameHub;
  const isEn = params.locale === "en";
  const gameName = isEn ? game.name : game.nameJa;

  const { stats, gameIndex, rows, gainers, losers, thumbs } = await getGameHubData(params.slug);

  // X シェア（intent リンク。クライアントJS不要）
  const pageUrl   = `${SITE_ORIGIN}${isEn ? "/en" : ""}/games/${game.slug}`;
  const shareText =
    gameIndex && gameIndex.value !== null
      ? `${gameName} ${h.indexTitle} ${gameIndex.value.toFixed(1)}` +
        (gameIndex.change30d !== null
          ? `（30d ${gameIndex.change30d > 0 ? "+" : ""}${gameIndex.change30d.toFixed(1)}%）`
          : "") +
        ` ${game.xHashtag}`
      : `${gameName} | Global Card Index ${game.xHashtag}`;
  const shareHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`;

  return (
    <div className="min-h-screen">
      {/* ── ゲーム独自ヘッダー（GCI 共通ヘッダーは layout 側で非表示） ── */}
      <header className="sticky top-0 z-40 border-b border-navy/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
          <Link href={`/games/${game.slug}`} className="flex min-w-0 items-center gap-2">
            <span className="text-2xl">{game.emoji}</span>
            <span className="truncate font-bold text-navy">{gameName}</span>
            <span className={`hidden text-[10px] font-semibold uppercase tracking-widest sm:inline ${game.color}`}>
              {h.indexTitle}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <a
              href={shareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/80"
            >
              𝕏 {h.shareOnX}
            </a>
            <Link href="/" className="text-[11px] text-navy/40 transition hover:text-navy">
              {h.gciHome} →
            </Link>
          </div>
        </div>
      </header>

      {/* ── ヒーロー（ゲームカラー帯） ── */}
      <section className={`${game.bgColor} border-b border-navy/10`}>
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-xs uppercase tracking-widest text-navy/50">{isEn ? game.nameJa : game.name}</p>
          <h1 className="mt-1 text-4xl font-bold text-navy">{gameName}</h1>
          <p className="mt-3 max-w-2xl text-sm text-navy/60">{isEn ? game.descriptionEn : game.description}</p>
          {game.hidden && (
            <p className="mt-4 inline-block border border-navy/15 bg-white/70 px-3 py-1.5 text-xs text-navy/60">
              {h.dataCollecting}
            </p>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">

      {/* ゲーム別指数ウィジェット */}
      {gameIndex && gameIndex.sampleCount > 0 && (
        <section className={`border border-navy/10 ${game.bgColor} p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <h2
              title={h.indexTooltip}
              className="text-xs uppercase tracking-widest text-navy/60 cursor-help"
            >
              {gameName} {h.indexTitle}
            </h2>
            <span className="rounded bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy/50 border border-navy/10">
              {gameIndex.confidence}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-5">
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/40">{h.indexTitle}</dt>
              <dd className={`mt-1 text-2xl font-bold tabular-nums ${game.color}`}>
                {gameIndex.value !== null ? gameIndex.value.toFixed(1) : "—"}
              </dd>
              {gameIndex.value === null && (
                <dd className="mt-0.5 text-[10px] text-navy/40">{h.indexPreparing}</dd>
              )}
            </div>
            <ChangeStat label={h.change24h} value={gameIndex.change24h} />
            <ChangeStat label={h.change7d}  value={gameIndex.change7d} />
            <ChangeStat label={h.change30d} value={gameIndex.change30d} />
            <div>
              <dt className="text-xs uppercase tracking-widest text-navy/40">{h.samples}</dt>
              <dd className="mt-1 text-lg tabular-nums text-navy/70">
                {gameIndex.sampleCount.toLocaleString()}
                <span className="ml-2 text-xs text-navy/40">/ {gameIndex.cardCount} {h.trackedCards}</span>
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* 騰落 Top5 */}
      {(gainers.length > 0 || losers.length > 0) ? (
        <div className="grid gap-6 md:grid-cols-2">
          <MoverList title={h.gainersTitle} rows={gainers} up />
          <MoverList title={h.losersTitle} rows={losers} up={false} />
        </div>
      ) : null}

      {/* ゲーム別マーケットボード */}
      {rows.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xs uppercase tracking-widest text-navy/50">{h.boardTitle}</h2>
              <p className="mt-1 text-xs text-navy/40">{h.boardNote}</p>
            </div>
            <Link href="/marketboard" className="text-[11px] text-navy/40 hover:text-navy transition underline underline-offset-2">
              {h.viewAllBoard}
            </Link>
          </div>
          <MarketTable rows={rows} locale={params.locale} labels={t.marketboard} thumbs={thumbs} />
        </section>
      )}

      {/* セット一覧 */}
      {stats && stats.sets.length > 0 && (
        <section>
          <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/50">
            {h.setsTitle}
            <span className="ml-2 normal-case text-navy/30">({stats.sets.length})</span>
          </h2>
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-sm">
              <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                <tr>
                  <th className="px-4 py-3">Set name</th>
                  <th className="px-4 py-3 text-right">Cards</th>
                  <th className="px-4 py-3 text-right">Avg price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {stats.sets.map((set) => (
                  <tr key={set.setName} className="hover:bg-navy/[0.02]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/sets/${encodeURIComponent(set.setName)}`}
                        className="font-medium text-navy hover:underline underline-offset-2"
                      >
                        {set.setName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy/60">
                      {set.cardCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy">
                      {set.avgPrice !== null && set.currency
                        ? formatPrice(set.avgPrice, set.currency)
                        : <span className="text-navy/25">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      </main>

      {/* ── 独立フッター ── */}
      <footer className="border-t border-navy/10 bg-white">
        <div className="mx-auto max-w-6xl space-y-4 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-navy/40">
            <p>
              {h.poweredBy}{" "}
              <Link href="/" className="underline underline-offset-2 transition hover:text-navy">
                Global Card Index
              </Link>
            </p>
            <nav className="flex gap-4">
              <Link href="/games" className="transition hover:text-navy">Games</Link>
              <Link href="/marketboard" className="transition hover:text-navy">Marketboard</Link>
              <Link href="/terms" className="transition hover:text-navy">Terms</Link>
            </nav>
          </div>
          <Disclaimer variant="footer" />
        </div>
      </footer>

      {/* 構造化データ (JSON-LD) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context":   "https://schema.org",
            "@type":      "WebPage",
            name:         isEn
              ? `${game.name} Price Index & Market Guide`
              : `${game.nameJa} 相場・価格指数`,
            description:  isEn ? game.descriptionEn : game.description,
            url:          `${SITE_ORIGIN}${isEn ? "/en" : ""}/games/${game.slug}`,
            publisher: {
              "@type": "Organization",
              name:    "Global Card Index",
            },
          }),
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------
// Sub components
// ----------------------------------------------------------------

function ChangeStat({ label, value }: { label: string; value: number | null }) {
  const color =
    value === null ? "text-navy/40" :
    value > 0 ? "text-gold-700" :
    value < 0 ? "text-red-600" : "text-navy/40";
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-navy/40">{label}</dt>
      <dd className={`mt-1 text-lg tabular-nums ${color}`}>
        {value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`}
      </dd>
    </div>
  );
}

function MoverList({
  title, rows, up,
}: {
  title: string; rows: MarketboardRow[]; up: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="border border-navy/10 bg-white p-5">
      <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/50">{title}</h2>
      <ul className="divide-y divide-navy/5">
        {rows.map((r) => (
          <li key={r.cardId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <Link
              href={`/cards/${r.cardId}`}
              className="min-w-0 flex-1 truncate font-medium text-navy hover:underline underline-offset-2"
            >
              {r.name}
              <span className="ml-2 text-xs font-normal text-navy/40">{r.setName}</span>
            </Link>
            <span className="shrink-0 tabular-nums text-navy/70">
              <PriceCell price={r.latestPrice} storedCurrency={r.currency} />
            </span>
            <span className={`w-16 shrink-0 text-right tabular-nums ${up ? "text-gold-700" : "text-red-600"}`}>
              {r.changeRate! > 0 ? "+" : ""}{r.changeRate!.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
