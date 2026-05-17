import type { Metadata }   from "next";
import { notFound }         from "next/navigation";
import Link                 from "next/link";
import { getGame, getGameSlugs } from "@/lib/seo/games";
import { getGameStats }     from "@/actions/seo";
import { formatPrice }      from "@/lib/utils/formatPrice";

// ----------------------------------------------------------------
// Static params  (ISR / static export に対応)
// ----------------------------------------------------------------
export async function generateStaticParams() {
  return getGameSlugs().map((slug) => ({ slug }));
}

// ----------------------------------------------------------------
// Metadata
// ----------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const game = getGame(params.slug);
  if (!game) return {};

  const title       = `${game.name} 相場・価格指数 | Global Card Index`;
  const description = game.description;
  const url         = `https://globalcardindex.com/games/${game.slug}`;

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
export default async function GamePage({
  params,
}: {
  params: { slug: string };
}) {
  const game  = getGame(params.slug);
  if (!game) notFound();

  const stats = await getGameStats(params.slug);

  return (
    <div className="space-y-8">
      {/* パンくず */}
      <nav className="text-xs uppercase tracking-widest text-navy/50">
        <Link href="/games" className="transition hover:text-navy">
          ← Games
        </Link>
      </nav>

      {/* ヘッダー */}
      <header className="border border-navy/10 bg-white p-8">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{game.emoji}</span>
          <div>
            <p className="text-xs uppercase tracking-widest text-navy/50">{game.nameJa}</p>
            <h1 className="mt-0.5 text-3xl font-semibold text-navy">{game.name}</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-navy/60">{game.description}</p>

        {stats && (
          <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="収録カード数" value={stats.cardCount.toLocaleString()} />
            <Stat label="セット数"     value={stats.setCount.toLocaleString()} />
            <Stat label="価格データ数" value={stats.priceCount.toLocaleString()} />
            <Stat
              label="最新観測価格"
              value={
                stats.latestPrice !== null && stats.currency
                  ? formatPrice(stats.latestPrice, stats.currency)
                  : "—"
              }
            />
          </dl>
        )}
      </header>

      {/* セット一覧 */}
      {stats && stats.sets.length > 0 ? (
        <section>
          <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/50">
            Sets
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
      ) : (
        <NoDataState gameName={game.name} />
      )}

      {/* 構造化データ (JSON-LD) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context":   "https://schema.org",
            "@type":      "WebPage",
            name:         `${game.name} 相場・価格指数`,
            description:  game.description,
            url:          `https://globalcardindex.com/games/${game.slug}`,
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-navy/50">{label}</dt>
      <dd className="mt-1 text-lg tabular-nums text-navy">{value}</dd>
    </div>
  );
}

function NoDataState({ gameName }: { gameName: string }) {
  return (
    <div className="border border-navy/10 bg-white p-12 text-center">
      <p className="text-3xl">📦</p>
      <p className="mt-3 text-sm font-medium text-navy">{gameName} のデータはまだありません</p>
      <p className="mt-1 text-xs text-navy/50">価格データが収集され次第、セット一覧が表示されます。</p>
    </div>
  );
}
