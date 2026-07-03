import Link from "next/link";
import {
  getPortfolioAnalyticsOverview,
  getPortfolioCardRows,
  type PortfolioCardSort,
  type PortfolioGrade,
} from "@gci/core";
import { prisma } from "@gci/db";

export const dynamic = "force-dynamic";

const GRADE_LABEL: Record<PortfolioGrade, string> = {
  RAW:          "Raw",
  PSA10:        "PSA 10",
  PSA_OTHER:    "PSA",
  OTHER_GRADED: "Other Graded",
};

const SORT_OPTIONS: { value: PortfolioCardSort; label: string }[] = [
  { value: "registered_desc", label: "登録数順" },
  { value: "value_desc",      label: "総評価額順" },
  { value: "recent_desc",     label: "直近登録順" },
];

function fmtYen(val: number | null): string {
  if (val === null) return "—";
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(val);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (d.getTime() === 0) return "—";
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function isValidSort(v: string | undefined): v is PortfolioCardSort {
  return v === "registered_desc" || v === "value_desc" || v === "recent_desc";
}

function isValidGrade(v: string | undefined): v is PortfolioGrade {
  return v === "RAW" || v === "PSA10" || v === "PSA_OTHER" || v === "OTHER_GRADED";
}

type SearchParams = { game?: string; grade?: string; q?: string; sort?: string };

export default async function AdminPortfolioPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const game   = searchParams.game || undefined;
  const grade  = isValidGrade(searchParams.grade) ? searchParams.grade : undefined;
  const search = searchParams.q || undefined;
  const sort   = isValidSort(searchParams.sort) ? searchParams.sort : "registered_desc";

  const [overview, rows, games] = await Promise.all([
    getPortfolioAnalyticsOverview(),
    getPortfolioCardRows({ game, grade, search, sort }),
    prisma.card.findMany({ select: { game: true }, distinct: ["game"] }).then((r) =>
      r.map((c) => c.game).filter((g): g is string => !!g).sort(),
    ),
  ]);

  const exportQuery = new URLSearchParams();
  if (game)   exportQuery.set("game", game);
  if (grade)  exportQuery.set("grade", grade);
  if (search) exportQuery.set("q", search);
  if (sort)   exportQuery.set("sort", sort);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-navy">Portfolio Analytics</h1>
        <p className="mt-1 text-sm text-navy/50">ユーザーポートフォリオの集計データ（カード単位・個人情報は含みません）</p>
      </div>

      {/* ── Overview stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "総登録ユーザー数",     value: overview.totalUsers.toLocaleString(),     unit: "人" },
          { label: "総登録カード種類数",   value: overview.totalCardTypes.toLocaleString(), unit: "種" },
          { label: "総登録枚数",          value: overview.totalQuantity.toLocaleString(),  unit: "枚" },
          {
            label: "平均登録枚数/ユーザー",
            value: overview.avgQuantityPerUser !== null ? overview.avgQuantityPerUser.toFixed(1) : "—",
            unit: "枚",
          },
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

      {/* ── Grade breakdown + Watch→Portfolio conversion ──────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-navy/10 bg-white p-5">
          <p className="text-[10px] uppercase tracking-widest text-navy/40 mb-3">グレード別比率</p>
          <div className="space-y-2">
            {overview.gradeBreakdown.map(({ grade: g, count, pct }) => (
              <div key={g} className="flex items-center gap-3">
                <span className="w-24 text-xs text-navy/60 shrink-0">{GRADE_LABEL[g]}</span>
                <div className="flex-1 h-2 bg-navy/5 rounded-full overflow-hidden">
                  <div className="h-full bg-navy/60 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-20 text-right text-xs tabular-nums text-navy/50 shrink-0">
                  {count.toLocaleString()} ({pct.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-navy/10 bg-white p-5">
          <p className="text-[10px] uppercase tracking-widest text-navy/40 mb-3">Watchlist → Portfolio Conversion</p>
          <div className="flex items-baseline gap-4">
            <div>
              <p className="text-2xl font-semibold text-navy tabular-nums">
                {overview.watchToPortfolioCount.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-navy/40">件</span>
              </p>
              <p className="text-[10px] text-navy/40 mt-0.5">転換数</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-navy tabular-nums">
                {overview.watchToPortfolioRate !== null ? `${overview.watchToPortfolioRate.toFixed(1)}%` : "—"}
              </p>
              <p className="text-[10px] text-navy/40 mt-0.5">転換率</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <form className="flex flex-wrap items-end gap-3 border border-navy/10 bg-white p-4">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-navy/40 mb-1">検索</label>
          <input
            type="text"
            name="q"
            defaultValue={search ?? ""}
            placeholder="カード名"
            className="border border-navy/15 px-3 py-1.5 text-sm outline-none focus:border-navy/50 transition w-48"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-navy/40 mb-1">ゲーム</label>
          <select name="game" defaultValue={game ?? ""} className="border border-navy/15 px-3 py-1.5 text-sm bg-white outline-none focus:border-navy/50 transition">
            <option value="">すべて</option>
            {games.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-navy/40 mb-1">グレード</label>
          <select name="grade" defaultValue={grade ?? ""} className="border border-navy/15 px-3 py-1.5 text-sm bg-white outline-none focus:border-navy/50 transition">
            <option value="">すべて</option>
            {(Object.keys(GRADE_LABEL) as PortfolioGrade[]).map((g) => (
              <option key={g} value={g}>{GRADE_LABEL[g]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-navy/40 mb-1">並び替え</label>
          <select name="sort" defaultValue={sort} className="border border-navy/15 px-3 py-1.5 text-sm bg-white outline-none focus:border-navy/50 transition">
            {SORT_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <button type="submit" className="border border-navy bg-navy px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy/80 transition">
          適用
        </button>
        <Link
          href={`/admin/portfolio/export?${exportQuery.toString()}`}
          className="border border-navy/20 px-4 py-1.5 text-xs text-navy/60 hover:border-navy hover:text-navy transition"
        >
          CSV Export
        </Link>
      </form>

      {/* ── Card-level table ───────────────────────────────────── */}
      <div className="border border-navy/10 bg-white overflow-x-auto">
        <div className="px-5 py-4 border-b border-navy/5 flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-navy/50">カード別集計（{rows.length}件）</p>
        </div>
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="border-b border-navy/5 bg-navy/[0.02]">
              {["カード", "ゲーム", "セット", "グレード", "登録ユーザー数", "総枚数", "平均取得単価", "現在値", "総評価額", "直近7日", "最終登録"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-navy/40 font-normal whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-sm text-navy/30">
                  該当するデータがありません。
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.cardId}:${row.grade}`} className="hover:bg-navy/[0.015] transition">
                  <td className="px-4 py-3">
                    {row.slug ? (
                      <a
                        href={`https://gci-index.com/cards/${row.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-navy hover:underline underline-offset-2"
                      >
                        {row.cardName}
                      </a>
                    ) : (
                      <span className="font-medium text-navy">{row.cardName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/50">{row.game ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-navy/50">{row.setName}</td>
                  <td className="px-4 py-3 text-xs text-navy/60">{GRADE_LABEL[row.grade]}</td>
                  <td className="px-4 py-3 tabular-nums text-navy/70">{row.registeredUsersCount}</td>
                  <td className="px-4 py-3 tabular-nums text-navy/70">{row.totalQuantity}</td>
                  <td className="px-4 py-3 tabular-nums text-navy/50">{fmtYen(row.avgBuyPrice)}</td>
                  <td className="px-4 py-3 tabular-nums text-navy/50">{fmtYen(row.currentMarketPrice)}</td>
                  <td className="px-4 py-3 tabular-nums font-medium text-navy">{fmtYen(row.totalEstimatedValue)}</td>
                  <td className="px-4 py-3 tabular-nums text-navy/50">{row.registeredCount7d}</td>
                  <td className="px-4 py-3 text-xs text-navy/40 whitespace-nowrap">{fmtDate(row.lastRegisteredAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
