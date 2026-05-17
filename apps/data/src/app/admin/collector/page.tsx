/**
 * /admin/collector
 *
 * Mercari search URL preview.
 * Reads data/watchlist.csv, generates one search URL per card+condition,
 * and renders them as a clickable table for manual collection runs.
 *
 * Sub-nav: URL Preview | Import | Runs
 */

import { readFileSync }           from "node:fs";
import { resolve }                from "node:path";
import Link                       from "next/link";
import {
  parseWatchlistCsv,
  buildMercariSearchUrls,
  type MercariSearchLink,
} from "@gci/core";

export const dynamic = "force-dynamic";

// ── Data ──────────────────────────────────────────────────────────────────────

function loadWatchlistLinks(): MercariSearchLink[] {
  try {
    const csvPath = resolve(process.cwd(), "../../data/watchlist.csv");
    const csv     = readFileSync(csvPath, "utf-8");
    const entries = parseWatchlistCsv(csv);
    return buildMercariSearchUrls(entries);
  } catch {
    return [];
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminCollectorPage() {
  const links = loadWatchlistLinks();

  const activeCount   = links.length;
  const gameGroups    = groupBy(links, (l) => l.game);

  return (
    <div className="space-y-8">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin › Collector</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Mercari Search URLs</h1>
        <p className="mt-1 text-sm text-navy/50">
          ウォッチリストから生成された Mercari 検索URLです。
          各リンクを開いてリストをコピーし、Import ページに貼り付けてください。
        </p>
      </header>

      {/* ── Sub-nav ──────────────────────────────────────────────────────── */}
      <CollectorSubNav active="urls" />

      {/* ── Summary ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Search URLs" value={activeCount} />
        <StatCard label="Games"       value={Object.keys(gameGroups).length} />
        <StatCard label="Conditions"  value={countDistinct(links, "condition")} />
      </div>

      {links.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          ウォッチリストが見つかりません。<code className="font-mono">data/watchlist.csv</code> を確認してください。
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(gameGroups).map(([game, gameLinks]) => (
            <section key={game}>
              <h2 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-navy/50">
                <GameBadge game={game} />
                {game}
                <span className="text-navy/30">({gameLinks.length} URLs)</span>
              </h2>

              <div className="overflow-x-auto border border-navy/10 bg-white">
                <table className="min-w-full divide-y divide-navy/10 text-sm">
                  <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                    <tr>
                      <th className="px-4 py-3">Card</th>
                      <th className="px-4 py-3">Set</th>
                      <th className="px-4 py-3">Rarity</th>
                      <th className="px-4 py-3">Cond</th>
                      <th className="px-4 py-3">Price Range</th>
                      <th className="px-4 py-3">Keyword</th>
                      <th className="px-4 py-3">Search</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy/5">
                    {gameLinks.map((link, idx) => (
                      <tr key={idx} className="hover:bg-navy/[0.02]">
                        <td className="px-4 py-3 font-medium text-navy">{link.cardName}</td>
                        <td className="px-4 py-3 text-navy/60">{link.set}</td>
                        <td className="px-4 py-3 text-navy/60">{link.rarity}</td>
                        <td className="px-4 py-3">
                          <CondBadge condition={link.condition} />
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-navy/50">
                          {link.priceRange}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-xs text-navy/40">
                          {link.keyword}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 transition"
                          >
                            Mercari
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Instruction panel ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-navy/10 bg-navy/[0.02] p-5 text-sm text-navy/60 space-y-2">
        <p className="font-medium text-navy">収集手順</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Search ボタンで Mercari 検索ページを開く</li>
          <li>検索結果の出品リストをコピーして JSON 形式で整形</li>
          <li>
            <Link href="/admin/collector/import" className="text-navy underline underline-offset-2">Import ページ</Link>
            {" "}に貼り付けてフィルター確認 → 投入
          </li>
          <li>
            <Link href="/admin/collector/runs" className="text-navy underline underline-offset-2">Runs ページ</Link>
            {" "}で収集ログを確認
          </li>
        </ol>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CollectorSubNav({ active }: { active: "urls" | "import" | "review" | "runs" }) {
  const items = [
    { href: "/admin/collector",        label: "URL Preview", key: "urls"   },
    { href: "/admin/collector/import", label: "Import",      key: "import" },
    { href: "/admin/collector/review", label: "Review",      key: "review" },
    { href: "/admin/collector/runs",   label: "Runs",        key: "runs"   },
  ];
  return (
    <div className="flex gap-1 border-b border-navy/10">
      {items.map(({ href, label, key }) => (
        <Link
          key={key}
          href={href}
          className={[
            "px-4 py-2 text-xs uppercase tracking-widest transition -mb-px border-b-2",
            active === key
              ? "border-navy text-navy font-medium"
              : "border-transparent text-navy/40 hover:text-navy/60",
          ].join(" ")}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-4">
      <p className="text-xs uppercase tracking-widest text-navy/40">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{value}</p>
    </div>
  );
}

function CondBadge({ condition }: { condition: string }) {
  const colors: Record<string, string> = {
    NM:  "bg-green-100 text-green-700",
    LP:  "bg-blue-100 text-blue-700",
    MP:  "bg-amber-100 text-amber-700",
    HP:  "bg-red-100 text-red-700",
    DMG: "bg-red-200 text-red-800",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[condition] ?? "bg-navy/10 text-navy/50"}`}>
      {condition}
    </span>
  );
}

function GameBadge({ game }: { game: string }) {
  const colors: Record<string, string> = {
    pokemon:  "bg-yellow-100 text-yellow-700",
    onepiece: "bg-red-100 text-red-700",
    unknown:  "bg-navy/10 text-navy/50",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${colors[game] ?? "bg-navy/10 text-navy/50"}`}>
      {game}
    </span>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] = acc[k] ?? []).push(item);
    return acc;
  }, {});
}

function countDistinct<T>(arr: T[], field: keyof T): number {
  return new Set(arr.map((i) => i[field])).size;
}

