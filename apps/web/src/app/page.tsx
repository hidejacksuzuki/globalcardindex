import Link from "next/link";
import { getLatestIndex, getIndexHistory } from "@gci/core";
import { IndexHero }         from "@/components/index/IndexHero";
import { Disclaimer, ConfidenceExplainer } from "@/components/common/Disclaimer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [snapshot, history] = await Promise.all([
    getLatestIndex(),
    getIndexHistory(30),
  ]);

  // Sparkline data (oldest → newest)
  const series = history.map((h) => h.value).reverse();

  return (
    <div className="space-y-10">

      {/* ── Beta badge ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-700">
          Public Beta
        </span>
        <span className="text-xs text-navy/40">
          データ収集継続中 · 指数精度は随時向上
        </span>
      </div>

      {/* ── GCI Index Hero ─────────────────────────────────────── */}
      <IndexHero snapshot={snapshot} series={series} />

      {/* ── What is GCI ────────────────────────────────────────── */}
      <section className="border border-navy/10 bg-white p-8 space-y-5">
        <h2 className="text-xs uppercase tracking-widest text-navy/50">GCIとは</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <AboutCard
            icon="📊"
            title="トレカ相場の指数化"
            body="メルカリ等の外部マーケットから収集した実売価格を集計し、カードゲーム市場全体の価格動向を一本の指数値（GCI）で可視化します。"
          />
          <AboutCard
            icon="🃏"
            title="カード別インデックス"
            body="個々のカードについても独立した指数値を算出。コンディション・レアリティ別に追跡し、relative な価格変動をモニタリングします。"
          />
          <AboutCard
            icon="🔍"
            title="信頼度の透明化"
            body="すべての指数値にサンプル数・外れ値率に基づく信頼度（HIGH/MED/LOW）を表示。データ不足の指数は参考値として明示します。"
          />
        </div>
      </section>

      {/* ── Confidence explainer ───────────────────────────────── */}
      <ConfidenceExplainer />

      {/* ── Navigation cards ───────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard
          href="/marketboard"
          label="Marketboard"
          desc="全追跡カードの最新価格・変動率一覧。信頼度別に分類して表示。"
          badge="市場一覧"
        />
        <NavCard
          href="/cards"
          label="Cards"
          desc="カード別インデックス・サンプル数・信頼度を確認できるカタログ。"
          badge="カード検索"
        />
        <NavCard
          href="/games"
          label="Games"
          desc="ポケモンカード・ワンピースカードなど対応ゲーム別に閲覧。"
          badge="ゲーム別"
        />
        <NavCard
          href="/daily"
          label="Daily Recap"
          desc="毎日更新の市場サマリー。上昇・下落・出来高急増カードを掲載。"
          badge="日次レポート"
        />
        <NavCard
          href="/indices"
          label="Index History"
          desc="GCI指数の推移チャート。30日・90日の価格変動トレンドを確認。"
          badge="指数履歴"
        />
        <NavCard
          href="/newsletter"
          label="Newsletter"
          desc="日次市場サマリーをメールで受け取る。無料・いつでも解除可能。"
          badge="メール配信"
        />
      </section>

      {/* ── Disclaimer ─────────────────────────────────────────── */}
      <Disclaimer variant="banner" />

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function AboutCard({
  icon, title, body,
}: { icon: string; title: string; body: string }) {
  return (
    <div className="space-y-2">
      <p className="text-2xl">{icon}</p>
      <p className="font-medium text-navy">{title}</p>
      <p className="text-sm text-navy/60 leading-relaxed">{body}</p>
    </div>
  );
}

function NavCard({
  href, label, desc, badge,
}: { href: string; label: string; desc: string; badge: string }) {
  return (
    <Link
      href={href}
      className="group border border-navy/10 bg-white p-6 transition hover:border-navy/30 hover:shadow-sm"
    >
      <p className="text-[10px] uppercase tracking-widest text-navy/40 mb-2">{badge}</p>
      <p className="text-base font-semibold text-navy group-hover:text-navy transition">
        {label} →
      </p>
      <p className="mt-1.5 text-sm text-navy/55 leading-relaxed">{desc}</p>
    </Link>
  );
}
