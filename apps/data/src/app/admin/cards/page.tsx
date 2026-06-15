/**
 * /admin/cards
 *
 * Card inventory dashboard:
 *   – Summary stats (total, orphans, potential duplicates)
 *   – Potential duplicate groups (same cardDedupeKey, different DB rows)
 *   – Orphan cards (0 price rows — safe to delete)
 *   – Full card inventory table (sortable by price count, latest price)
 */

import { prisma }                from "@gci/db";
import { cardDedupeKey }         from "@gci/core";
import { ImportWatchlistButton } from "./ImportWatchlistButton";
import { CardInventoryTable }    from "./CardInventoryTable";
import { AddCardForm }           from "./AddCardForm";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type CardRow = {
  id:        string;
  name:      string;
  setName:   string;
  rarity:    string;
  condition: string;
  slug:      string | null;
  game:      string | null;
  priceCount: number;
  latestPrice: number | null;
  latestAt:    Date   | null;
  createdAt:   Date;
  isVisible:   boolean;
  deletedAt:   Date | null;
  mergedIntoCardId: string | null;
};

type DuplicateGroup = {
  key:   string;
  cards: CardRow[];
};

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getCardInventory(): Promise<{
  cards:      CardRow[];
  orphans:    CardRow[];
  dupGroups:  DuplicateGroup[];
}> {
  // Load all cards with aggregate price data in one query
  const raw = await prisma.card.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id:               true,
      name:             true,
      setName:          true,
      rarity:           true,
      condition:        true,
      slug:             true,
      game:             true,
      createdAt:        true,
      isVisible:        true,
      deletedAt:        true,
      mergedIntoCardId: true,
      prices: {
        orderBy: { observedAt: "desc" },
        take:    1,
        select:  { price: true, observedAt: true },
      },
      _count: { select: { prices: true } },
    },
  });

  const cards: CardRow[] = raw.map((c) => ({
    id:               c.id,
    name:             c.name,
    setName:          c.setName,
    rarity:           c.rarity,
    condition:        c.condition,
    slug:             c.slug,
    game:             c.game,
    priceCount:       c._count.prices,
    latestPrice:      c.prices[0]?.price ?? null,
    latestAt:         c.prices[0]?.observedAt ?? null,
    createdAt:        c.createdAt,
    isVisible:        c.isVisible,
    deletedAt:        c.deletedAt,
    mergedIntoCardId: c.mergedIntoCardId,
  }));

  // Orphans: no price data
  const orphans = cards.filter((c) => c.priceCount === 0);

  // Duplicate detection via cardDedupeKey
  const keyMap = new Map<string, CardRow[]>();
  for (const card of cards) {
    const k = cardDedupeKey({
      name:      card.name,
      setName:   card.setName,
      rarity:    card.rarity,
      condition: card.condition,
    });
    const existing = keyMap.get(k);
    if (existing) {
      existing.push(card);
    } else {
      keyMap.set(k, [card]);
    }
  }

  const dupGroups: DuplicateGroup[] = [];
  for (const [key, group] of keyMap) {
    if (group.length > 1) {
      // Sort group: most prices first (likely the canonical row)
      group.sort((a, b) => b.priceCount - a.priceCount);
      dupGroups.push({ key, cards: group });
    }
  }
  // Sort groups by size descending
  dupGroups.sort((a, b) => b.cards.length - a.cards.length);

  return { cards, orphans, dupGroups };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminCardsPage() {
  const { cards, orphans, dupGroups } = await getCardInventory();

  const totalPrices   = cards.reduce((s, c) => s + c.priceCount, 0);
  const dupCardCount  = dupGroups.reduce((s, g) => s + g.cards.length, 0);

  return (
    <div className="space-y-10">
      <header className="border-b border-navy/10 pb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-navy/40">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold text-navy">Cards</h1>
          <p className="mt-1 text-sm text-navy/50">
            カードDB在庫の確認、孤立カードの検出、表記ゆれ重複の検出。
          </p>
        </div>
        <div className="mt-2 shrink-0">
          <ImportWatchlistButton />
        </div>
      </header>

      {/* ── Add card form ───────────────────────────────────────────────────── */}
      <AddCardForm />

      {/* ── Summary stats ──────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Cards"
          value={cards.length.toLocaleString()}
          sub="DB rows"
          color="border-navy/10 bg-white"
        />
        <StatCard
          label="Total Prices"
          value={totalPrices.toLocaleString()}
          sub="across all cards"
          color="border-navy/10 bg-white"
        />
        <StatCard
          label="Orphan Cards"
          value={orphans.length.toLocaleString()}
          sub="0 prices — safe to delete"
          color={orphans.length > 0 ? "border-amber-200 bg-amber-50" : "border-navy/10 bg-white"}
        />
        <StatCard
          label="Dup Groups"
          value={dupGroups.length.toLocaleString()}
          sub={`${dupCardCount} cards affected`}
          color={dupGroups.length > 0 ? "border-red-200 bg-red-50" : "border-navy/10 bg-white"}
        />
      </section>

      {/* ── Duplicate groups ────────────────────────────────────────────────── */}
      {dupGroups.length > 0 && (
        <section>
          <h2 className="mb-1 text-xs uppercase tracking-widest text-navy/40">
            Potential Duplicates
          </h2>
          <p className="mb-4 text-[11px] text-navy/40">
            同じ normalizeCardKey になるカードが複数 DB に存在します。
            最もデータが多い行（先頭）を残し、他を削除することを検討してください。
          </p>
          <div className="space-y-4">
            {dupGroups.map((group) => (
              <div
                key={group.key}
                className="overflow-hidden rounded-lg border border-red-200 bg-white"
              >
                <div className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-xs">
                  <span className="font-medium text-red-700">Key: </span>
                  <code className="font-mono text-red-600">{group.key}</code>
                  <span className="ml-3 text-red-400">{group.cards.length} rows</span>
                </div>
                <table className="min-w-full divide-y divide-navy/5 text-sm">
                  <thead className="bg-navy/[0.02] text-left text-xs uppercase tracking-wider text-navy/40">
                    <tr>
                      <th className="px-4 py-2">ID</th>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Set</th>
                      <th className="px-4 py-2">Rarity</th>
                      <th className="px-4 py-2">Cond</th>
                      <th className="px-4 py-2 text-right">Prices</th>
                      <th className="px-4 py-2 text-right">Latest ¥</th>
                      <th className="px-4 py-2">Slug</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy/5">
                    {group.cards.map((c, idx) => (
                      <tr
                        key={c.id}
                        className={idx === 0 ? "bg-green-50" : "bg-red-50/40"}
                      >
                        <td className="px-4 py-2 font-mono text-[11px] text-navy/40">{c.id}</td>
                        <td className="px-4 py-2 font-medium text-navy">{c.name}</td>
                        <td className="px-4 py-2 text-navy/60">{c.setName}</td>
                        <td className="px-4 py-2 text-navy/60">{c.rarity}</td>
                        <td className="px-4 py-2 text-navy/60">{c.condition}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-navy">
                          {c.priceCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-navy/60">
                          {c.latestPrice != null
                            ? `¥${c.latestPrice.toLocaleString()}`
                            : <span className="text-navy/25">—</span>}
                        </td>
                        <td className="px-4 py-2 font-mono text-[11px] text-navy/40">
                          {c.slug ?? <span className="text-navy/25">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Full inventory table ────────────────────────────────────────────── */}
      <CardInventoryTable cards={cards} />

      {/* ── Orphans ─────────────────────────────────────────────────────────── */}
      {orphans.length > 0 && (
        <section>
          <h2 className="mb-1 text-xs uppercase tracking-widest text-navy/40">
            Orphan Cards
          </h2>
          <p className="mb-4 text-[11px] text-navy/40">
            価格データが 0 件のカード行です。安全に削除できます。
          </p>
          <div className="overflow-x-auto border border-amber-200 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-sm">
              <thead className="bg-amber-50 text-left text-xs uppercase tracking-widest text-navy/50">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Set</th>
                  <th className="px-4 py-3">Rarity</th>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {orphans.map((c) => (
                  <tr key={c.id} className="hover:bg-amber-50/40">
                    <td className="px-4 py-2 font-mono text-[11px] text-navy/40">{c.id}</td>
                    <td className="px-4 py-2 font-medium text-navy">{c.name}</td>
                    <td className="px-4 py-2 text-navy/60">{c.setName}</td>
                    <td className="px-4 py-2 text-navy/60">{c.rarity}</td>
                    <td className="px-4 py-2 text-navy/60">{c.condition}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-navy/40">
                      {c.slug ?? <span className="text-navy/25">—</span>}
                    </td>
                    <td className="px-4 py-2 text-[11px] text-navy/40 tabular-nums">
                      {c.createdAt.toLocaleDateString("ja-JP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-navy/40">
            削除: <code className="font-mono">DELETE FROM Card WHERE id IN (…) AND (SELECT COUNT(*) FROM Price WHERE cardId = Card.id) = 0;</code>
          </p>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub:   string;
  color: string;
}) {
  return (
    <div className={`rounded-lg border p-5 ${color}`}>
      <p className="text-xs uppercase tracking-widest text-navy/40">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{value}</p>
      <p className="mt-0.5 text-[11px] text-navy/40">{sub}</p>
    </div>
  );
}
