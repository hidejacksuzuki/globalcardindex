import { prisma } from "@gci/db";

export const dynamic = "force-dynamic";

export default async function AdminPortfolioPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalCards,
    totalQuantity,
    recentCount,
    topCards,
  ] = await Promise.all([
    prisma.portfolioCard.groupBy({ by: ["userId"] }).then((r) => r.length),
    prisma.portfolioCard.count(),
    prisma.portfolioCard.aggregate({ _sum: { quantity: true } }).then((r) => r._sum.quantity ?? 0),
    prisma.portfolioCard.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.portfolioCard.groupBy({
      by:      ["cardId"],
      _count:  { userId: true },
      _sum:    { quantity: true },
      orderBy: { _count: { userId: "desc" } },
      take:    20,
    }),
  ]);

  // カード名を取得
  const cardIds = topCards.map((r) => r.cardId);
  const cards   = await prisma.card.findMany({
    where:  { id: { in: cardIds } },
    select: { id: true, name: true, setName: true, game: true, slug: true },
  });
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-navy">Portfolio Analytics</h1>
        <p className="mt-1 text-sm text-navy/50">ユーザーポートフォリオの集計データ</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "登録ユーザー数",      value: totalUsers.toLocaleString(),    unit: "人" },
          { label: "登録エントリー数",     value: totalCards.toLocaleString(),    unit: "件" },
          { label: "総登録枚数",          value: totalQuantity.toLocaleString(), unit: "枚" },
          { label: "直近7日の新規登録",   value: recentCount.toLocaleString(),   unit: "件" },
        ].map(({ label, value, unit }) => (
          <div key={label} className="border border-navy/10 bg-white p-5">
            <p className="text-[10px] uppercase tracking-widest text-navy/40">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-navy tabular-nums">
              {value}
              <span className="ml-1 text-sm font-normal text-navy/40">{unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Top cards by user count */}
      <div className="border border-navy/10 bg-white">
        <div className="px-5 py-4 border-b border-navy/5">
          <p className="text-xs uppercase tracking-widest text-navy/50">人気カード（登録ユーザー数順）</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy/5 bg-navy/[0.02]">
              {["#", "カード", "セット", "ゲーム", "登録ユーザー数", "総枚数"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-navy/40 font-normal whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {topCards.map((row, i) => {
              const card = cardMap.get(row.cardId);
              return (
                <tr key={row.cardId} className="hover:bg-navy/[0.015] transition">
                  <td className="px-4 py-3 text-navy/30 tabular-nums">{i + 1}</td>
                  <td className="px-4 py-3">
                    {card?.slug ? (
                      <a
                        href={`https://gci-index.com/cards/${card.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-navy hover:underline underline-offset-2"
                      >
                        {card?.name ?? row.cardId}
                      </a>
                    ) : (
                      <span className="font-medium text-navy">{card?.name ?? row.cardId}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/50">{card?.setName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-navy/50">{card?.game ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-navy/70">{row._count.userId}</td>
                  <td className="px-4 py-3 tabular-nums text-navy/70">{row._sum.quantity ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
