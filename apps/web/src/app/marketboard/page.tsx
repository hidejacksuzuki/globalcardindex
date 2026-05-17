/**
 * /marketboard
 *
 * Week 19: Split into two sections:
 *   1. Reliable signals  — cards with HIGH or MED confidence index
 *   2. Reference data    — cards with LOW confidence or no index
 *
 * Both sections show latest price, index value, 30-day change, and sample count.
 */

import Link            from "next/link";
import { getMarketboard, formatPrice, MARKET_SORT_KEYS } from "@gci/core";
import { SearchBar }   from "@/components/ui/SearchBar";
import { Disclaimer }  from "@/components/common/Disclaimer";
import type { MarketboardRow, MarketSortKey, MarketSortOrder } from "@gci/core";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: { q?: string; sort?: string; order?: string; section?: string };
};

function parseSort(s: string | undefined): MarketSortKey | null {
  if (!s) return null;
  return (MARKET_SORT_KEYS as readonly string[]).includes(s)
    ? (s as MarketSortKey)
    : null;
}

function parseOrder(o: string | undefined): MarketSortOrder {
  return o === "asc" ? "asc" : "desc";
}

export default async function MarketboardPage({ searchParams }: Props) {
  const q       = searchParams.q?.trim() || undefined;
  const sort    = parseSort(searchParams.sort);
  const order   = parseOrder(searchParams.order);
  const section = searchParams.section === "reference" ? "reference" : "reliable";

  const rows = await getMarketboard({ search: q, sort, order });

  // Split: reliable = HIGH or MED confidence index; reference = LOW or none
  const reliable  = rows.filter((r) => r.confidence === "HIGH" || r.confidence === "MED");
  const reference = rows.filter((r) => r.confidence !== "HIGH" && r.confidence !== "MED");

  const activeRows   = section === "reliable"  ? reliable  : reference;
  const updatedAt    = rows.length > 0
    ? rows.map((r) => r.lastObservedAt).filter(Boolean).sort().at(-1)
    : null;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-navy/10 pb-5 space-y-1">
        <h1 className="text-2xl font-semibold text-navy">Marketboard</h1>
        <p className="text-sm text-navy/60">
          追跡カードの最新価格・指数・信頼度一覧。
          {updatedAt && (
            <span className="ml-2 text-navy/40">
              最終更新: {new Date(updatedAt).toLocaleDateString("ja-JP")}
            </span>
          )}
        </p>
      </header>

      {/* ── Search ─────────────────────────────────────────────── */}
      <SearchBar action="/marketboard" defaultValue={q} placeholder="カード名・セット名で検索" />

      {/* ── Section tabs ───────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-navy/10">
        <SectionTab
          label={`信頼できる指数 (${reliable.length})`}
          href={buildHref({ q, sort, order, section: "reliable" })}
          active={section === "reliable"}
        />
        <SectionTab
          label={`参考値 / データ不足 (${reference.length})`}
          href={buildHref({ q, sort, order, section: "reference" })}
          active={section === "reference"}
        />
      </div>

      {/* ── Reference explanation ──────────────────────────────── */}
      {section === "reference" && reference.length > 0 && (
        <aside className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          このセクションのカードはサンプル数が少なく、指数値の精度が限定的です。
          目安として参照してください。
        </aside>
      )}

      {/* ── Search result count ────────────────────────────────── */}
      {q && (
        <p className="text-xs text-navy/50">
          {activeRows.length} 件 <span className="text-navy/70">&ldquo;{q}&rdquo;</span>
          {" · "}
          <a href="/marketboard" className="underline hover:text-navy">クリア</a>
        </p>
      )}

      {/* ── Table ──────────────────────────────────────────────── */}
      {activeRows.length === 0 ? (
        <p className="rounded border border-navy/10 bg-white p-6 text-sm text-navy/50">
          {q ? "該当するカードがありません。" : "このセクションにカードがありません。"}
        </p>
      ) : (
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <table className="min-w-full divide-y divide-navy/10 text-sm">
            <thead className="bg-navy/5 text-left text-[10px] uppercase tracking-widest text-navy/50">
              <tr>
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Set</th>
                <th className="px-4 py-3">Cond</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3 text-right">Index</th>
                <th className="px-4 py-3 text-right">Δ Index</th>
                <th className="px-4 py-3 text-right">Samples</th>
                <th className="px-4 py-3 text-right">Latest ¥</th>
                <th className="px-4 py-3 text-right">Δ 30d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {activeRows.map((row) => (
                <MarketRow key={row.cardId} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Disclaimer variant="banner" />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MarketRow({ row }: { row: MarketboardRow }) {
  return (
    <tr className="text-navy/80 transition hover:bg-navy/[0.02]">
      <td className="px-4 py-3">
        <Link
          href={`/cards/${row.cardId}`}
          className="font-medium text-navy hover:text-gold-700 transition"
        >
          {row.name}
        </Link>
      </td>
      <td className="max-w-[120px] truncate px-4 py-3 text-xs text-navy/50">
        {row.setName}
      </td>
      <td className="px-4 py-3">
        <CondBadge condition={row.condition} />
      </td>
      <td className="px-4 py-3">
        {row.confidence
          ? <ConfidenceBadge tier={row.confidence} />
          : <span className="text-xs text-navy/25">—</span>
        }
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold text-navy">
        {row.indexValue != null
          ? row.indexValue.toFixed(1)
          : <span className="text-navy/25">—</span>
        }
      </td>
      <td className="px-4 py-3 text-right">
        {row.indexChange != null
          ? <ChangeRate rate={row.indexChange} />
          : <span className="text-navy/25">—</span>
        }
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-navy/55">
        {row.sampleCount != null ? row.sampleCount : <span className="text-navy/25">—</span>}
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-medium">
        {row.latestPrice != null && row.currency
          ? formatPrice(row.latestPrice, row.currency)
          : <span className="text-navy/25">—</span>
        }
      </td>
      <td className="px-4 py-3 text-right">
        {row.changeRate != null
          ? <ChangeRate rate={row.changeRate} />
          : <span className="text-navy/25">—</span>
        }
      </td>
    </tr>
  );
}

function SectionTab({
  label, href, active,
}: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "px-4 py-2 text-xs uppercase tracking-widest transition -mb-px border-b-2",
        active
          ? "border-navy text-navy font-medium"
          : "border-transparent text-navy/40 hover:text-navy/60",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function ConfidenceBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    HIGH: "bg-green-100 text-green-700",
    MED:  "bg-amber-100 text-amber-700",
    LOW:  "bg-red-100   text-red-600",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[tier] ?? "bg-navy/10 text-navy/50"}`}>
      {tier}
    </span>
  );
}

function CondBadge({ condition }: { condition: string }) {
  const colors: Record<string, string> = {
    NM:  "bg-green-100 text-green-700",
    LP:  "bg-blue-100  text-blue-700",
    MP:  "bg-amber-100 text-amber-700",
    HP:  "bg-red-100   text-red-700",
    DMG: "bg-red-200   text-red-800",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[condition] ?? "bg-navy/10 text-navy/50"}`}>
      {condition}
    </span>
  );
}

function ChangeRate({ rate }: { rate: number }) {
  const color  = rate > 0 ? "text-gold-700" : rate < 0 ? "text-red-600" : "text-navy/40";
  const prefix = rate > 0 ? "▲" : rate < 0 ? "▼" : "";
  return (
    <span className={`text-xs tabular-nums ${color}`}>
      {prefix}{Math.abs(rate).toFixed(1)}%
    </span>
  );
}

function buildHref(params: {
  q?: string;
  sort?: MarketSortKey | null;
  order?: MarketSortOrder;
  section?: string;
}): string {
  const p = new URLSearchParams();
  if (params.q)                    p.set("q",       params.q);
  if (params.sort)                 p.set("sort",    params.sort);
  if (params.order === "asc")      p.set("order",   "asc");
  if (params.section)              p.set("section", params.section);
  const qs = p.toString();
  return qs ? `/marketboard?${qs}` : "/marketboard";
}
