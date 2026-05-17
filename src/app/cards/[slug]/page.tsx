import type { Metadata }   from "next";
import { notFound }         from "next/navigation";
import Link                 from "next/link";
import { getCardBySlug }    from "@/actions/seo";
import { getGame }          from "@/lib/seo/games";
import { WatchButton }      from "@/components/watchlist/WatchButton";
import { isWatching }       from "@/actions/watchlist";
import { formatPrice }      from "@/lib/utils/formatPrice";

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
  const url         = `https://globalcardindex.com/cards/${card.slug}`;

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

  // isWatching は cardId (cuid) で引く（slug とは別物）
  const watchedById = await isWatching(card.id).catch(() => false);

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

        <div className="mt-4">
          <WatchButton cardId={card.id} isWatched={watchedById} />
        </div>

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

        {(card.minPrice !== null || card.maxPrice !== null) && card.currency && (
          <div className="mt-6 flex gap-6 border-t border-navy/5 pt-6 text-sm">
            {card.minPrice !== null && (
              <div>
                <span className="text-xs uppercase tracking-widest text-navy/40">Min</span>
                <span className="ml-2 tabular-nums text-navy/60">
                  {formatPrice(card.minPrice, card.currency)}
                </span>
              </div>
            )}
            {card.maxPrice !== null && (
              <div>
                <span className="text-xs uppercase tracking-widest text-navy/40">Max</span>
                <span className="ml-2 tabular-nums text-navy/60">
                  {formatPrice(card.maxPrice, card.currency)}
                </span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* 内部リンク: ID ベースの詳細ページへ */}
      <div className="text-right text-xs">
        <Link
          href={`/cards/${card.id}`}
          className="text-navy/40 hover:text-navy transition underline underline-offset-2"
        >
          価格履歴グラフを見る →
        </Link>
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
            url:        `https://globalcardindex.com/cards/${card.slug}`,
            ...(card.latestPrice !== null && card.currency
              ? {
                  offers: {
                    "@type":         "Offer",
                    priceCurrency:   card.currency,
                    price:           card.latestPrice.toFixed(0),
                    availability:    "https://schema.org/InStock",
                    url:             `https://globalcardindex.com/cards/${card.slug}`,
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
