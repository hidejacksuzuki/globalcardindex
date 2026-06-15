/**
 * /admin/ebay-aliases
 *
 * CardAlias 管理画面。
 * カードごとの英語名・セット名・カード番号・検索クエリを編集できる。
 */

import { prisma }       from "@gci/db";
import { AliasEditor }  from "./AliasEditor";

export const dynamic = "force-dynamic";

async function getAliases() {
  return prisma.cardAlias.findMany({
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      card: { select: { id: true, name: true, setName: true, rarity: true, condition: true, game: true } },
      _count: { select: { ebayListings: true } },
    },
  });
}

export default async function EbayAliasesPage() {
  const aliases = await getAliases();

  const totalListings = aliases.reduce((s, a) => s + a._count.ebayListings, 0);

  return (
    <div className="space-y-8">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin › eBay</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">eBay Aliases</h1>
        <p className="mt-1 text-sm text-navy/50">
          カードの英語名・カード番号・検索クエリを管理します。eBay収集の精度に直結します。
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-navy/10 bg-white p-4">
          <p className="text-xs uppercase tracking-widest text-navy/40">Aliases</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{aliases.length}</p>
        </div>
        <div className="rounded-lg border border-navy/10 bg-white p-4">
          <p className="text-xs uppercase tracking-widest text-navy/40">Cards</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-navy">
            {new Set(aliases.map((a) => a.cardId)).size}
          </p>
        </div>
        <div className="rounded-lg border border-navy/10 bg-white p-4">
          <p className="text-xs uppercase tracking-widest text-navy/40">Total Listings</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{totalListings}</p>
        </div>
      </div>

      <AliasEditor aliases={aliases} />
    </div>
  );
}
