/**
 * /admin/collector/ebay
 *
 * eBay Sold Listings 収集・承認画面。
 * CardAlias を選択して検索し、pending → approved → imported フローで Price に取り込む。
 */

import Link           from "next/link";
import { prisma }     from "@gci/db";
import { EbayCollector } from "./EbayCollector";

export const dynamic = "force-dynamic";

async function getData() {
  const [aliases, stats] = await Promise.all([
    prisma.cardAlias.findMany({
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      include: {
        card: { select: { id: true, name: true, setName: true, rarity: true, game: true } },
      },
    }),
    prisma.ebayListing.groupBy({
      by:     ["status"],
      _count: { id: true },
    }),
  ]);

  const statusMap = Object.fromEntries(stats.map((s) => [s.status, s._count.id]));

  return { aliases, statusMap };
}

export default async function EbayCollectorPage() {
  const { aliases, statusMap } = await getData();

  return (
    <div className="space-y-8">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin › Collector</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">eBay Collector</h1>
        <p className="mt-1 text-sm text-navy/50">
          CardAlias を選択して eBay Sold Listings を検索・承認・Price に変換します。
        </p>
      </header>

      {/* Sub-nav */}
      <CollectorSubNav active="ebay" />

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Pending"  value={statusMap["pending"]  ?? 0} color="border-navy/10"   />
        <StatCard label="Approved" value={statusMap["approved"] ?? 0} color="border-emerald-200" highlight="text-emerald-700" />
        <StatCard label="Rejected" value={statusMap["rejected"] ?? 0} color="border-red-200"    highlight="text-red-700" />
        <StatCard label="Imported" value={statusMap["imported"] ?? 0} color="border-blue-200"   highlight="text-blue-700" />
      </section>

      {aliases.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white p-8 text-center text-sm text-navy/40">
          CardAlias が未登録です。
          <Link href="/admin/ebay-aliases" className="ml-1 text-navy underline underline-offset-2">
            eBay Aliases
          </Link>
          {" "}ページで作成してください。
        </div>
      ) : (
        <EbayCollector aliases={aliases} />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CollectorSubNav({ active }: { active: string }) {
  const items = [
    { href: "/admin/collector",        label: "URL Preview", key: "urls"   },
    { href: "/admin/collector/import", label: "Import",      key: "import" },
    { href: "/admin/collector/review", label: "Review",      key: "review" },
    { href: "/admin/collector/runs",   label: "Runs",        key: "runs"   },
    { href: "/admin/collector/ebay",   label: "eBay",        key: "ebay"   },
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

function StatCard({
  label, value, color, highlight = "text-navy",
}: {
  label: string; value: number; color: string; highlight?: string;
}) {
  return (
    <div className={`rounded-lg border p-4 bg-white ${color}`}>
      <p className="text-xs uppercase tracking-widest text-navy/40">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${highlight}`}>{value}</p>
    </div>
  );
}
