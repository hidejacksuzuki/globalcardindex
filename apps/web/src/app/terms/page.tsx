/**
 * /terms
 * 利用規約・免責事項
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:  "利用規約 · 免責事項",
  description:
    "Global Card Index（GCI）の利用規約と免責事項。価格データの性質、投資助言の否定、外部マーケットとの関係について。",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 py-4">

      {/* Breadcrumb */}
      <nav className="text-xs uppercase tracking-widest text-navy/40">
        <Link href="/" className="hover:text-navy transition">Home</Link>
        <span className="mx-2">/</span>
        <span>利用規約</span>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold text-navy">利用規約・免責事項</h1>
        <p className="mt-2 text-sm text-navy/50">最終更新: 2026年5月</p>
      </header>

      <Section title="1. サービス概要">
        <p>
          Global Card Index（以下「本サービス」）は、トレーディングカードの市場価格動向を
          可視化することを目的とした情報提供サービスです。メルカリ等の外部マーケットから
          収集した取引価格データを集計・指数化して提供します。
        </p>
      </Section>

      <Section title="2. 投資助言ではありません">
        <p>
          本サービスが提供する価格データ・指数値・変動率・市場動向情報は、
          <strong className="text-navy font-semibold">投資助言・売買推奨を構成するものではありません。</strong>
          掲載情報を参考にした取引・売買等の判断は利用者ご自身の責任において行ってください。
          本サービスは投資助言業者ではなく、金融商品取引法上の規制を受けるサービスでもありません。
        </p>
      </Section>

      <Section title="3. 価格保証について">
        <p>
          本サービスに掲載される価格情報は、外部マーケットの取引データを参考集計したものです。
          <strong className="text-navy font-semibold">実際の取引価格を保証するものではありません。</strong>
          市場価格は需給・タイミング・カード状態等により大きく変動します。
          掲載価格と実際の売買価格が異なる場合があります。
        </p>
      </Section>

      <Section title="4. データの性質と限界">
        <p>各カードの指数値には「信頼度（Confidence）」を付与しています：</p>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex gap-2">
            <span className="shrink-0 rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 self-start mt-0.5">HIGH</span>
            <span>サンプル10件以上・外れ値率20%未満。比較的信頼できる指数値。</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 self-start mt-0.5">MED</span>
            <span>サンプル3件以上。参考として有効ですが変動に注意。</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 self-start mt-0.5">LOW / 参考値</span>
            <span>サンプルが少なく精度が限定的。目安として参照してください。</span>
          </li>
        </ul>
        <p className="mt-3">
          サービスは現在パブリックベータ段階です。データ収集・指数計算アルゴリズムは改善中であり、
          予告なく変更される場合があります。
        </p>
      </Section>

      <Section title="5. 外部マーケットとの関係">
        <p>
          本サービスはメルカリ等の外部マーケットとは独立した第三者サービスです。
          各マーケットの利用規約・ガイドラインに従いデータを収集していますが、
          外部マーケット事業者との提携・公認関係はありません。
          カードの実際の購入・売却は各マーケットサービス上でのみ行われます。
        </p>
      </Section>

      <Section title="6. 免責事項">
        <p>
          本サービスの利用により生じたいかなる損害（直接的・間接的を問わず）についても、
          運営者は責任を負いかねます。情報の正確性・完全性・最新性について保証を行いません。
          システムの可用性・継続性についても保証を行いません。
        </p>
      </Section>

      <Section title="7. サービスの変更・停止">
        <p>
          運営者は事前の告知なく本サービスの内容変更・機能追加・停止を行うことがあります。
          パブリックベータ期間中は特に変更が頻繁に行われる場合があります。
        </p>
      </Section>

      <div className="border-t border-navy/10 pt-6 text-xs text-navy/40">
        ご不明な点はサービス内のフィードバック機能または{" "}
        <Link href="/" className="underline hover:text-navy/60">トップページ</Link>{" "}
        よりお問い合わせください。
      </div>

    </div>
  );
}

function Section({
  title, children,
}: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      <div className="text-sm text-navy/70 leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}
