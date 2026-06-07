/**
 * /beta
 * クローズドβ参加申し込みページ。
 * 「価格サイトではなく市場指数」のポジションを伝えながら、
 * Discord と メール の2経路で参加を促す。
 */

import type { Metadata } from "next";
import Link              from "next/link";

export const metadata: Metadata = {
  title:  "クローズドβ参加 — Global Card Index",
  description:
    "GCI クローズドベータへようこそ。カード市場の指数インフラを一緒に作りましょう。先行アクセス・フィードバック特典あり。",
  robots: { index: true, follow: true },
};

// Discord invite URL — replace with actual link once server is created
const DISCORD_INVITE = process.env.NEXT_PUBLIC_DISCORD_INVITE ?? "https://discord.gg/placeholder";

export default function BetaPage() {
  return (
    <div className="mx-auto max-w-xl space-y-12 py-4">

      {/* ── Badge ─────────────────────────────────────────────────── */}
      <div className="flex justify-center">
        <span className="inline-block rounded-full border border-gold-300 bg-gold-50 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-gold-700">
          Closed Beta
        </span>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <header className="text-center space-y-4">
        <h1 className="text-3xl font-semibold text-navy leading-tight">
          カード市場に<br />
          日経平均を。
        </h1>
        <p className="text-sm text-navy/60 leading-relaxed">
          GCI はトレーディングカードの<strong className="font-medium text-navy">市場指数インフラ</strong>です。
          個別価格ではなく、市場全体の体温を数値で。
          現在、クローズドβとして 5〜20 人の方に先行公開中です。
        </p>
      </header>

      {/* ── What beta users get ──────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-navy/40 text-center">βユーザーが得られること</p>
        <div className="space-y-2">
          {[
            { icon: "🔓", text: "全機能への先行アクセス（Marketboard・Indices・Watchlist など）" },
            { icon: "📣", text: "Discord の専用チャンネルで直接フィードバックができる" },
            { icon: "🏗️", text: "ロードマップに影響を与えられる（欲しい機能を伝えてほしい）" },
            { icon: "📊", text: "追跡してほしいカードをリクエストできる" },
            { icon: "🔔", text: "大幅変動カードの Discord リアルタイム通知" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-start gap-3 rounded border border-navy/8 bg-white px-4 py-3">
              <span className="text-lg shrink-0">{icon}</span>
              <p className="text-sm text-navy/70 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Join CTAs ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <p className="text-xs uppercase tracking-widest text-navy/40 text-center">参加方法</p>

        {/* Discord */}
        <a
          href={DISCORD_INVITE}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded border border-indigo-200 bg-indigo-50 px-5 py-4 transition hover:bg-indigo-100"
        >
          <span className="text-2xl">💬</span>
          <div className="flex-1">
            <p className="font-semibold text-navy text-sm">Discord サーバーに参加する</p>
            <p className="text-xs text-navy/50 mt-0.5">
              最速の参加方法。#beta-feedback・#market-alerts など専用チャンネルあり。
            </p>
          </div>
          <span className="text-navy/30 text-xs">→</span>
        </a>

        {/* Newsletter */}
        <Link
          href="/newsletter"
          className="flex items-center gap-4 rounded border border-navy/10 bg-white px-5 py-4 transition hover:bg-navy/[0.02]"
        >
          <span className="text-2xl">📧</span>
          <div className="flex-1">
            <p className="font-semibold text-navy text-sm">メールで参加申し込み</p>
            <p className="text-xs text-navy/50 mt-0.5">
              日次サマリーとβ招待リンクをお送りします。
            </p>
          </div>
          <span className="text-navy/30 text-xs">→</span>
        </Link>
      </section>

      {/* ── Who we want ─────────────────────────────────────────── */}
      <section className="rounded border border-navy/10 bg-white p-6 space-y-3">
        <p className="text-xs uppercase tracking-widest text-navy/40">こんな方に来てほしい</p>
        <ul className="space-y-2 text-sm text-navy/70">
          {[
            "ポケカ / ワンピカードを定期的に売買している",
            "カードの相場を毎日チェックする習慣がある",
            "カードショップを運営している、または関わっている",
            "TCG を投資・資産として考えている",
            "「こんなデータがほしい」という具体的な意見がある",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* ── Current status ───────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-navy/40 text-center">現在の対応ゲーム</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { emoji: "⚡", name: "Pokémon TCG", ja: "ポケモンカード", status: "稼働中" },
            { emoji: "⚓", name: "One Piece Card Game", ja: "ワンピースカード", status: "稼働中" },
            { emoji: "🃏", name: "Yu-Gi-Oh! OCG", ja: "遊戯王OCG", status: "近日予定" },
            { emoji: "✨", name: "Magic: The Gathering", ja: "MTG", status: "近日予定" },
          ].map(({ emoji, name, ja, status }) => (
            <div key={name} className="rounded border border-navy/10 bg-white p-3 flex items-start gap-2">
              <span className="text-lg">{emoji}</span>
              <div>
                <p className="text-xs font-medium text-navy">{ja}</p>
                <p className={`text-[10px] mt-0.5 ${status === "稼働中" ? "text-green-600" : "text-navy/40"}`}>
                  {status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer note ──────────────────────────────────────────── */}
      <div className="text-center space-y-2 text-xs text-navy/40 border-t border-navy/10 pt-6">
        <p>GCI は現在パブリックβ段階です。機能・データは継続的に改善されます。</p>
        <p>
          <Link href="/about" className="underline hover:text-navy/60">GCIについて詳しく</Link>
          {" · "}
          <Link href="/terms" className="underline hover:text-navy/60">利用規約</Link>
        </p>
      </div>

    </div>
  );
}
