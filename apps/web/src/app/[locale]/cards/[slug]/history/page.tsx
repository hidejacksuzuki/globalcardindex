import { notFound }    from "next/navigation";
import Link              from "next/link";
import { getCard }       from "@gci/core";
import { isWatching, isUserWatching } from "@gci/core";
import { PriceHistory }  from "@/components/cards/PriceHistory";
import { WatchButton }   from "@/components/watchlist/WatchButton";
import { formatDateTime } from "@gci/core";
import { formatPrice } from "@gci/core";
import { auth }          from "@/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { slug: string };
};

export default async function CardHistoryPage({ params }: PageProps) {
  const session = await auth();
  const userId  = session?.user?.id ?? null;

  const [card, watched] = await Promise.all([
    getCard(params.slug),
    userId
      ? isUserWatching(userId, params.slug).catch(() => false)
      : isWatching(params.slug).catch(() => false),
  ]);
  if (!card) notFound();

  const latest = card.prices[0] ?? null;
  const distinctSources = new Set(card.prices.map((p) => p.sourceName)).size;

  return (
    <div className="space-y-8">
      <nav className="text-xs uppercase tracking-widest text-navy/50">
        <Link href="/marketboard" className="transition hover:text-navy">
          ← Marketboard
        </Link>
      </nav>

      <header className="border border-navy/10 bg-white p-8">
        <p className="text-xs uppercase tracking-widest text-navy/50">
          {card.setName}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-navy">{card.name}</h1>
        <p className="mt-1 text-sm text-navy/60">
          {card.rarity} · {card.condition}
        </p>

        <div className="mt-4">
          <WatchButton cardId={card.id} isWatched={watched} userId={userId ?? undefined} />
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat
            label="Latest price"
            value={
              latest ? formatPrice(latest.price, latest.currency) : "-"
            }
          />
          <Stat
            label="Last seen"
            value={latest ? formatDateTime(latest.observedAt) : "-"}
          />
          <Stat label="Observations" value={String(card.prices.length)} />
          <Stat label="Sources" value={String(distinctSources)} />
        </dl>
      </header>

      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/50">
          Price history
        </h2>
        <PriceHistory prices={card.prices} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-navy/50">
        {label}
      </dt>
      <dd className="mt-1 text-lg tabular-nums text-navy">{value}</dd>
    </div>
  );
}
