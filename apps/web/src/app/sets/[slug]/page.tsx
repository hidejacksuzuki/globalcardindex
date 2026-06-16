import type { Metadata }  from "next";
import { notFound }        from "next/navigation";
import Link                from "next/link";
import { getSetStats }     from "@gci/core";
import { getGame }         from "@gci/core";
import { formatPrice }     from "@gci/core";

export const revalidate = 3600; // ISR: 1時間キャッシュ

// ----------------------------------------------------------------
// Metadata
// ----------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const setName = decodeURIComponent(params.slug);
  const stats   = await getSetStats(setName);
  if (!stats) return {};

  const title       = `${stats.setName} 相場・価格一覧 | Global Card Index`;
  const description = `${stats.setName} (${stats.cardCount}種) の市場価格データ。レアリティ・状態別の最新価格・7日間騰落率を掲載。`;
  const url         = `https://gci-index.com/sets/${encodeURIComponent(stats.setName)}`;

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
export default async function SetPage({
  params,
}: {
  params: { slug: string };
}) {
  const setName = decodeURIComponent(params.slug);
  const stats   = await getSetStats(setName);
  if (!stats) notFound();

  const game = stats.game ? getGame(stats.game) : null;

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
        <span className="text-navy/70">{stats.setName}</span>
      </nav>

      {/* ヘッダー */}
      <header className="border border-navy/10 bg-white p-8">
        {game && (
          <p className="text-xs uppercase tracking-widest text-navy/50">{game.name}</p>
        )}
        <h1 className="mt-1 text-3xl font-semibold text-navy">{stats.setName}</h1>
        <p className="mt-1 text-sm text-navy/60">
          {stats.cardCount.toLocaleString()} 種のカード価格データ
        </p>
      </header>

      {/* カード一覧 */}
      {stats.cards.length > 0 ? (
        <section>
          <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/50">
            Cards
            <span className="ml-2 normal-case text-navy/30">({stats.cards.length})</span>
          </h2>
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-sm">
              <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                <tr>
                  <th className="px-4 py-3">Card</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">7d</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {stats.cards.map((card) => (
                  <tr key={card.id} className="hover:bg-navy/[0.02]">
                    <td className="px-4 py-3">
                      <Link
                        href={card.slug ? `/cards/${card.slug}` : `/cards/${card.id}`}
                        className="font-medium text-navy hover:underline underline-offset-2"
                      >
                        {card.name}
                      </Link>
                      <p className="text-[10px] text-navy/40">
                        {card.rarity} · {card.condition}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-navy">
                      {card.latestPrice !== null && card.currency
                        ? formatPrice(card.latestPrice, card.currency)
                        : <span className="text-navy/25">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Change7d value={card.change7d} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="border border-navy/10 bg-white p-12 text-center">
          <p className="text-sm text-navy/50">このセットの価格データはまだありません。</p>
        </div>
      )}

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context":  "https://schema.org",
            "@type":     "ItemList",
            name:        `${stats.setName} カード一覧`,
            description: `${stats.setName} の市場価格データ`,
            url:         `https://gci-index.com/sets/${encodeURIComponent(stats.setName)}`,
            numberOfItems: stats.cardCount,
          }),
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------
// Sub component
// ----------------------------------------------------------------

function Change7d({ value }: { value: number | null }) {
  if (value === null) return <span className="text-navy/25 text-xs">—</span>;
  const isPos  = value > 0;
  const color  = isPos ? "text-gold-700" : value < 0 ? "text-red-600" : "text-navy/40";
  const prefix = isPos ? "▲" : value < 0 ? "▼" : "";
  return (
    <span className={`tabular-nums text-xs ${color}`}>
      {prefix}{Math.abs(value).toFixed(1)}%
    </span>
  );
}
