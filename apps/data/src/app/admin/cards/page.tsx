/**
 * /admin/cards — サイドバー型カード管理ダッシュボード
 *
 * URL params:
 *   ?game=pokemon|onepiece|yugioh|mtg|duelmasters   — ゲーム絞り込み
 *   ?view=all|visible|hidden|orphan|merged|deleted   — ゲーム別ステータス
 *   ?view=duplicates|orphans|requests|recent         — 全ゲーム横断
 */

import { prisma }                from "@gci/db";
import { cardDedupeKey }         from "@gci/core";
import { Suspense }              from "react";
import { ImportWatchlistButton } from "./ImportWatchlistButton";
import { CardInventoryTable }    from "./CardInventoryTable";
import { AddCardForm }           from "./AddCardForm";
import { DuplicateGroups }       from "./DuplicateGroups";
import { CardSidebar, SIDEBAR_GAMES } from "./CardSidebar";
import type { DupCard, DupGroup } from "./DuplicateGroups";
import type { SidebarCounts, GameCounts } from "./CardSidebar";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type CardRow = {
  id:               string;
  name:             string;
  setName:          string;
  rarity:           string;
  condition:        string;
  slug:             string | null;
  game:             string | null;
  priceCount:       number;
  latestPrice:      number | null;
  latestAt:         Date   | null;
  createdAt:        Date;
  isVisible:        boolean;
  deletedAt:        Date | null;
  mergedIntoCardId: string | null;
};

type CardRequestRow = {
  id:          string;
  name:        string;
  setName:     string | null;
  game:        string | null;
  rarity:      string | null;
  requestedBy: string | null;
  note:        string | null;
  status:      string;
  createdAt:   Date;
};

// ── Data fetching ─────────────────────────────────────────────────────────────

function cardToDupCard(c: CardRow): DupCard {
  return {
    id:               c.id,
    name:             c.name,
    setName:          c.setName,
    rarity:           c.rarity,
    condition:        c.condition,
    slug:             c.slug,
    game:             c.game,
    priceCount:       c.priceCount,
    latestPrice:      c.latestPrice,
    isVisible:        c.isVisible,
    deletedAt:        c.deletedAt,
    mergedIntoCardId: c.mergedIntoCardId,
  };
}

async function getAllData(): Promise<{
  cards:      CardRow[];
  dupGroups:  DupGroup[];
  dupCardIds: Set<string>;
  requests:   CardRequestRow[];
}> {
  const [raw, rawRequests] = await Promise.all([
    prisma.card.findMany({
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
    }),
    prisma.cardRequest.findMany({
      where:   { status: "pending" },
      orderBy: { createdAt: "desc" },
      take:    200,
      select: {
        id:          true,
        name:        true,
        setName:     true,
        game:        true,
        rarity:      true,
        requestedBy: true,
        note:        true,
        status:      true,
        createdAt:   true,
      },
    }),
  ]);

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

  const keyMap = new Map<string, CardRow[]>();
  for (const card of cards) {
    if (card.deletedAt) continue;
    const k = cardDedupeKey({
      name:      card.name,
      setName:   card.setName,
      rarity:    card.rarity,
      condition: card.condition,
    });
    const existing = keyMap.get(k);
    if (existing) existing.push(card);
    else keyMap.set(k, [card]);
  }

  const dupGroups: DupGroup[] = [];
  for (const [key, group] of keyMap) {
    if (group.length > 1) {
      group.sort((a, b) => b.priceCount - a.priceCount);
      dupGroups.push({ key, cards: group.map(cardToDupCard) });
    }
  }
  dupGroups.sort((a, b) => b.cards.length - a.cards.length);

  const dupCardIds = new Set<string>();
  for (const g of dupGroups) {
    for (const c of g.cards) dupCardIds.add(c.id);
  }

  return { cards, dupGroups, dupCardIds, requests: rawRequests };
}

function computeCounts(
  cards:      CardRow[],
  dupGroups:  DupGroup[],
  dupCardIds: Set<string>,
  requests:   CardRequestRow[],
): SidebarCounts {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const games: Record<string, GameCounts> = {};
  for (const { key } of SIDEBAR_GAMES) {
    const gc = cards.filter((c) => c.game === key);
    games[key] = {
      all:     gc.length,
      visible: gc.filter((c) =>  c.isVisible && !c.deletedAt && !c.mergedIntoCardId).length,
      hidden:  gc.filter((c) => !c.isVisible && !c.deletedAt && !c.mergedIntoCardId).length,
      orphan:  gc.filter((c) =>  c.priceCount === 0 && !c.deletedAt).length,
      merged:  gc.filter((c) =>  dupCardIds.has(c.id)).length,
      deleted: gc.filter((c) =>  !!c.deletedAt).length,
    };
  }

  return {
    games,
    global: {
      duplicates: dupGroups.length,
      orphans:    cards.filter((c) => c.priceCount === 0 && !c.deletedAt).length,
      requests:   requests.length,
      recent:     cards.filter((c) => c.createdAt >= sevenDaysAgo).length,
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; view?: string }>;
}) {
  const sp          = await searchParams;
  const currentGame = sp.game ?? null;
  const currentView = sp.view ?? null;

  const { cards, dupGroups, dupCardIds, requests } = await getAllData();
  const counts = computeCounts(cards, dupGroups, dupCardIds, requests);

  const gameCards = currentGame
    ? cards.filter((c) => c.game === currentGame)
    : cards;

  const gameDupGroups = currentGame
    ? dupGroups.filter((g) => g.cards.some((c) => c.game === currentGame))
    : dupGroups;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // ── コンテンツ切り替え ─────────────────────────────────────────────────────

  let content: React.ReactNode;

  if (!currentGame && !currentView) {
    // ダッシュボード
    const totalPrices  = cards.reduce((s, c) => s + c.priceCount, 0);
    const orphanCount  = cards.filter((c) => c.priceCount === 0 && !c.deletedAt).length;
    const dupCardCount = dupGroups.reduce((s, g) => s + g.cards.length, 0);
    content = (
      <div className="space-y-8">
        <header className="flex items-start justify-between gap-4 border-b border-navy/10 pb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-navy/40">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold text-navy">カード管理</h1>
            <p className="mt-1 text-sm text-navy/50">
              カードDB在庫の確認、価格孤立検出、表記ゆれ重複の検出。
            </p>
          </div>
          <div className="mt-2 shrink-0">
            <ImportWatchlistButton />
          </div>
        </header>

        <AddCardForm />

        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Cards"  value={cards.length.toLocaleString()}     sub="DB rows"         color="border-navy/10 bg-white" />
          <StatCard label="Total Prices" value={totalPrices.toLocaleString()}      sub="across all"      color="border-navy/10 bg-white" />
          <StatCard label="Orphan Cards" value={orphanCount.toLocaleString()}      sub="0 prices"        color={orphanCount   > 0 ? "border-amber-200 bg-amber-50" : "border-navy/10 bg-white"} />
          <StatCard label="Dup Groups"   value={dupGroups.length.toLocaleString()} sub={`${dupCardCount} cards`} color={dupGroups.length > 0 ? "border-red-200 bg-red-50" : "border-navy/10 bg-white"} />
        </section>

        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">ゲーム別</h2>
          <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-sm">
              <thead className="bg-navy/5 text-left text-xs uppercase tracking-wider text-navy/50">
                <tr>
                  <th className="px-4 py-3">ゲーム</th>
                  <th className="px-4 py-3 text-right">全カード</th>
                  <th className="px-4 py-3 text-right">公開中</th>
                  <th className="px-4 py-3 text-right">非公開</th>
                  <th className="px-4 py-3 text-right">未確認</th>
                  <th className="px-4 py-3 text-right">統合候補</th>
                  <th className="px-4 py-3 text-right">削除候補</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {SIDEBAR_GAMES.map(({ key, label }) => {
                  const gc = counts.games[key];
                  if (!gc) return null;
                  return (
                    <tr key={key} className="hover:bg-navy/[0.02]">
                      <td className="px-4 py-3 font-medium text-navy">{label}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{gc.all.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{gc.visible.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600">{gc.hidden.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy/50">{gc.orphan.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-purple-600">{gc.merged.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-500">{gc.deleted.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  } else if (currentGame && currentView === "merged") {
    const gameLabel = SIDEBAR_GAMES.find((g) => g.key === currentGame)?.label ?? currentGame;
    content = (
      <div className="space-y-6">
        <ViewHeader
          title={`${gameLabel} — 統合候補`}
          sub="同一カードと判定されたグループです。「グループ統合」で価格履歴を親に集約できます。"
        />
        {gameDupGroups.length > 0
          ? <DuplicateGroups groups={gameDupGroups} />
          : <EmptyState message="統合候補のカードはありません。" />}
      </div>
    );
  } else if (currentGame && currentView) {
    const gameLabel = SIDEBAR_GAMES.find((g) => g.key === currentGame)?.label ?? currentGame;

    let filtered: CardRow[];
    let title: string;
    let sub: string;

    switch (currentView) {
      case "all":
        filtered = gameCards;
        title    = `${gameLabel} — 全カード`;
        sub      = "このゲームの全カード。";
        break;
      case "visible":
        filtered = gameCards.filter((c) => c.isVisible && !c.deletedAt && !c.mergedIntoCardId);
        title    = `${gameLabel} — 公開中`;
        sub      = "公開中のカード。";
        break;
      case "hidden":
        filtered = gameCards.filter((c) => !c.isVisible && !c.deletedAt && !c.mergedIntoCardId);
        title    = `${gameLabel} — 非公開`;
        sub      = "非表示に設定されているカード。";
        break;
      case "orphan":
        filtered = gameCards.filter((c) => c.priceCount === 0 && !c.deletedAt);
        title    = `${gameLabel} — 未確認`;
        sub      = "価格データが 0 件のカード（まだ収集されていない）。";
        break;
      case "deleted":
        filtered = gameCards.filter((c) => !!c.deletedAt);
        title    = `${gameLabel} — 削除候補`;
        sub      = "soft delete されたカード。「復元」で元に戻せます。";
        break;
      default:
        filtered = gameCards;
        title    = `${gameLabel} — 全カード`;
        sub      = "";
    }

    content = (
      <div className="space-y-4">
        <ViewHeader title={title} sub={sub} />
        {filtered.length > 0
          ? <CardInventoryTable cards={filtered} />
          : <EmptyState message="該当するカードはありません。" />}
      </div>
    );
  } else if (!currentGame && currentView === "duplicates") {
    content = (
      <div className="space-y-6">
        <ViewHeader title="重複候補" sub="同一カードと判定されたグループ（全ゲーム横断）。" />
        {dupGroups.length > 0
          ? <DuplicateGroups groups={dupGroups} />
          : <EmptyState message="重複候補のカードはありません。" />}
      </div>
    );
  } else if (!currentGame && currentView === "orphans") {
    const orphans = cards.filter((c) => c.priceCount === 0 && !c.deletedAt);
    content = (
      <div className="space-y-4">
        <ViewHeader title="価格未登録" sub="価格データが 0 件のカード（全ゲーム横断）。" />
        {orphans.length > 0
          ? <CardInventoryTable cards={orphans} />
          : <EmptyState message="価格未登録のカードはありません。" />}
      </div>
    );
  } else if (!currentGame && currentView === "requests") {
    content = (
      <div className="space-y-4">
        <ViewHeader title="人気リクエスト" sub="ユーザーからの追加リクエスト（pending）。" />
        {requests.length > 0
          ? <RequestsTable requests={requests} />
          : <EmptyState message="未処理のリクエストはありません。" />}
      </div>
    );
  } else if (!currentGame && currentView === "recent") {
    const recent = cards.filter((c) => c.createdAt >= sevenDaysAgo);
    content = (
      <div className="space-y-4">
        <ViewHeader title="最近追加" sub="過去 7 日以内に追加されたカード。" />
        {recent.length > 0
          ? <CardInventoryTable cards={recent} />
          : <EmptyState message="過去 7 日以内に追加されたカードはありません。" />}
      </div>
    );
  } else {
    content = <EmptyState message="ページが見つかりません。" />;
  }

  return (
    <div className="flex gap-8">
      {/* ── サイドバー ──────────────────────────────────────────────────────── */}
      <aside className="w-48 shrink-0 border-r border-navy/10 pr-4">
        <Suspense fallback={<div className="h-64 w-48" />}>
          <CardSidebar counts={counts} />
        </Suspense>
      </aside>

      {/* ── メインコンテンツ ─────────────────────────────────────────────────── */}
      <main className="min-w-0 flex-1">
        {content}
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color,
}: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className={`rounded-lg border p-5 ${color}`}>
      <p className="text-xs uppercase tracking-widest text-navy/40">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{value}</p>
      <p className="mt-0.5 text-[11px] text-navy/40">{sub}</p>
    </div>
  );
}

function ViewHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="border-b border-navy/10 pb-4">
      <h1 className="text-xl font-semibold text-navy">{title}</h1>
      {sub && <p className="mt-0.5 text-sm text-navy/50">{sub}</p>}
    </header>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-10 text-center text-sm text-navy/40">
      {message}
    </div>
  );
}

function RequestsTable({ requests }: { requests: CardRequestRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
      <table className="min-w-full divide-y divide-navy/10 text-sm">
        <thead className="bg-navy/5 text-left text-xs uppercase tracking-wider text-navy/50">
          <tr>
            <th className="px-4 py-3">カード名</th>
            <th className="px-4 py-3">セット</th>
            <th className="px-4 py-3">ゲーム</th>
            <th className="px-4 py-3">レアリティ</th>
            <th className="px-4 py-3">リクエスト者</th>
            <th className="px-4 py-3">メモ</th>
            <th className="px-4 py-3">日付</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/5">
          {requests.map((r) => (
            <tr key={r.id} className="hover:bg-navy/[0.02]">
              <td className="px-4 py-3 font-medium text-navy">{r.name}</td>
              <td className="px-4 py-3 text-navy/60">{r.setName ?? <span className="text-navy/25">—</span>}</td>
              <td className="px-4 py-3 text-navy/60">{r.game ?? <span className="text-navy/25">—</span>}</td>
              <td className="px-4 py-3 text-navy/60">{r.rarity ?? <span className="text-navy/25">—</span>}</td>
              <td className="px-4 py-3 text-[11px] text-navy/50">{r.requestedBy ?? <span className="text-navy/25">—</span>}</td>
              <td className="px-4 py-3 max-w-[180px] truncate text-[11px] text-navy/50">{r.note ?? <span className="text-navy/25">—</span>}</td>
              <td className="px-4 py-3 text-[11px] tabular-nums text-navy/40 whitespace-nowrap">
                {r.createdAt.toLocaleDateString("ja-JP")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
