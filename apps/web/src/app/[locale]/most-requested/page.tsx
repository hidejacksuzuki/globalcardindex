/**
 * /most-requested
 *
 * Public page showing the most-requested cards by community.
 * Market demand signal — "the cards people want tracked."
 */

import type { Metadata }    from "next";
import Link                 from "next/link";
import { CardRequestButton } from "@/components/cards/CardRequestButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:       "Most Requested Cards | Global Card Index",
  description: "コミュニティが最も追加を求めているトレカのリスト。市場需要のシグナルです。",
  robots:      { index: true, follow: true },
};

type Group = {
  name:  string;
  game:  string | null;
  count: number;
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gci-index.com";

const GAME_LABEL: Record<string, string> = {
  pokemon:  "ポケカ",
  onepiece: "ワンピース",
  yugioh:   "遊戯王",
  mtg:      "MTG",
  other:    "その他",
};

const GAME_COLOR: Record<string, string> = {
  pokemon:  "bg-red-100 text-red-700",
  onepiece: "bg-blue-100 text-blue-700",
  yugioh:   "bg-purple-100 text-purple-700",
  mtg:      "bg-amber-100 text-amber-700",
  other:    "bg-navy/10 text-navy/50",
};

async function fetchPopular(game?: string): Promise<Group[]> {
  try {
    const qs  = new URLSearchParams({ limit: "50" });
    if (game) qs.set("game", game);
    const res  = await fetch(`${BASE_URL}/api/v1/card-requests/popular?${qs.toString()}`, {
      next: { revalidate: 300 },  // cache 5 min
    });
    const json = await res.json() as { ok: boolean; groups?: Group[] };
    return json.ok && Array.isArray(json.groups) ? json.groups : [];
  } catch {
    return [];
  }
}

type Props = {
  searchParams: { game?: string };
};

export default async function MostRequestedPage({ searchParams }: Props) {
  const gameFilter = searchParams.game?.trim() || undefined;
  const groups     = await fetchPopular(gameFilter);

  const GAMES = ["pokemon", "onepiece", "yugioh", "mtg"];

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">

      {/* Hero */}
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-navy/40">Community Signal</p>
        <h1 className="text-3xl font-semibold text-navy">Most Requested Cards</h1>
        <p className="text-sm text-navy/60">
          ユーザーが最も追加をリクエストしているカード。市場需要の先行指標です。
        </p>
      </header>

      {/* Game filter */}
      <div className="flex flex-wrap gap-2">
        <GamePill label="すべて" href="/most-requested"          active={!gameFilter} />
        {GAMES.map((g) => (
          <GamePill
            key={g}
            label={GAME_LABEL[g] ?? g}
            href={`/most-requested?game=${g}`}
            active={gameFilter === g}
            game={g}
          />
        ))}
      </div>

      {/* List */}
      {groups.length === 0 ? (
        <div className="rounded border border-navy/10 bg-white p-8 text-center space-y-4">
          <p className="text-sm text-navy/50">まだリクエストはありません。</p>
          <p className="text-xs text-navy/40">あなたが最初のリクエストを送りましょう！</p>
          <div className="flex justify-center">
            <CardRequestButton />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g, i) => (
            <RequestRow key={`${g.name}-${g.game ?? ""}-${i}`} group={g} rank={i + 1} />
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="rounded border border-navy/10 bg-white px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-navy">お探しのカードがない？</p>
          <p className="text-xs text-navy/50 mt-0.5">リクエストを送ると、このリストに表示されます。</p>
        </div>
        <CardRequestButton />
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-navy/35 text-center">
        リクエストは需要シグナルとして公開されます。追加はコレクター判断で行われます。
        <Link href="/terms" className="underline ml-1 hover:text-navy/60">利用規約</Link>
      </p>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GamePill({ label, href, active, game }: { label: string; href: string; active: boolean; game?: string }) {
  const color = game ? GAME_COLOR[game] : "";
  return (
    <Link
      href={href}
      className={[
        "rounded-full border px-3 py-1 text-[11px] font-medium transition",
        active
          ? game
            ? `${color} border-transparent`
            : "bg-navy text-white border-navy"
          : "border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function RequestRow({ group, rank }: { group: Group; rank: number }) {
  const isHot  = group.count >= 5;
  const isWarm = group.count >= 3;

  return (
    <div className="flex items-center gap-4 rounded border border-navy/10 bg-white px-4 py-3 hover:bg-navy/[0.02] transition">
      {/* Rank */}
      <span className={[
        "w-7 shrink-0 text-center text-sm font-bold tabular-nums",
        rank === 1 ? "text-amber-500" :
        rank === 2 ? "text-navy/40" :
        rank === 3 ? "text-amber-700/70" :
        "text-navy/25",
      ].join(" ")}>
        {rank}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-navy truncate">{group.name}</p>
        {group.game && (
          <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${GAME_COLOR[group.game] ?? "bg-navy/10 text-navy/50"}`}>
            {GAME_LABEL[group.game] ?? group.game}
          </span>
        )}
      </div>

      {/* Request count */}
      <div className="shrink-0 text-right">
        <span className={[
          "inline-block rounded-full px-3 py-0.5 text-xs font-bold tabular-nums",
          isHot  ? "bg-amber-100 text-amber-700" :
          isWarm ? "bg-blue-100 text-blue-700" :
          "bg-navy/8 text-navy/50",
        ].join(" ")}>
          {group.count} req
        </span>
        {isHot && <p className="mt-0.5 text-[10px] text-amber-600 font-medium">🔥 需要高</p>}
      </div>
    </div>
  );
}
