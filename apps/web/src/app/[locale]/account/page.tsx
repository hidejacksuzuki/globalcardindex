/**
 * /account
 *
 * Authenticated user's account page.
 * Shows: profile email, persistent watchlist, notification preferences.
 *
 * Protected by middleware — always has session when rendered.
 */

import type { Metadata }        from "next";
import { redirect }             from "next/navigation";
import Link                     from "next/link";
import { auth }                 from "@/auth";
import { prisma }               from "@gci/db";
import { getUserWatchlistCards } from "@gci/core";
import { formatPrice }          from "@gci/core";
import { SignOutButton }        from "./SignOutButton";
import { NotifPrefsForm }       from "./NotifPrefsForm";
import { MigrateBanner }        from "./MigrateBanner";
import { cookies }              from "next/headers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:  "アカウント | Global Card Index",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/account");

  const userId = session.user.id;
  const email  = session.user.email ?? "";

  // Watchlist + NotifPrefs — parallel fetch
  const [watchlistCards, notifPrefs] = await Promise.all([
    getUserWatchlistCards(userId),
    prisma.notificationPrefs.findUnique({ where: { userId } }),
  ]);

  // Check for anonymous session cookie to show migration banner
  const cookieStore = cookies();
  const anonSessionId = cookieStore.get("gci_session")?.value ?? null;
  const hasAnonWatchlist = anonSessionId
    ? await prisma.watchlist.findUnique({
        where:  { sessionId: anonSessionId },
        select: { _count: { select: { items: true } } },
      }).then((w: { _count: { items: number } } | null) => (w?._count.items ?? 0) > 0)
    : false;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 sm:px-0">

      {/* Header */}
      <header className="flex items-start justify-between border-b border-navy/10 pb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-navy/40">My Account</p>
          <h1 className="mt-1 text-2xl font-semibold text-navy">アカウント</h1>
          <p className="mt-1.5 text-sm text-navy/55">{email}</p>
        </div>
        <SignOutButton />
      </header>

      {/* Migration banner — anon cookie watchlist found */}
      {hasAnonWatchlist && anonSessionId && (
        <MigrateBanner sessionId={anonSessionId} />
      )}

      {/* Watchlist */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-navy/50">
            ウォッチリスト
            {watchlistCards.length > 0 && (
              <span className="ml-1.5 normal-case font-normal text-navy/35">
                ({watchlistCards.length}件)
              </span>
            )}
          </h2>
          <Link href="/cards" className="text-xs text-navy/40 hover:text-navy transition underline">
            カードを追加 →
          </Link>
        </div>

        {watchlistCards.length === 0 ? (
          <div className="rounded border border-navy/10 bg-white px-8 py-10 text-center space-y-4">
            <p className="text-3xl">☆</p>
            <div className="space-y-1">
              <p className="text-sm font-medium text-navy/60">ウォッチリストは空です</p>
              <p className="text-xs text-navy/40">
                カード詳細ページの「Watch」ボタンで追加すると、<br className="hidden sm:inline" />
                価格変動をメールでお知らせします。
              </p>
            </div>
            <Link
              href="/cards"
              className="inline-block rounded border border-navy/20 px-4 py-2 text-xs font-medium text-navy/60 transition hover:border-navy hover:text-navy"
            >
              カードカタログを見る →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-navy/5 border border-navy/10 bg-white">
            {watchlistCards.map((card) => (
              <WatchlistRow key={card.cardId} card={card} />
            ))}
          </div>
        )}
      </section>

      {/* Notification preferences */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-navy/50">
          通知設定
        </h2>
        <NotifPrefsForm
          prefs={{
            marketAlerts: notifPrefs?.marketAlerts ?? true,
            weeklyRecap:  notifPrefs?.weeklyRecap  ?? true,
            newsletter:   notifPrefs?.newsletter   ?? false,
          }}
        />
      </section>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function WatchlistRow({ card }: { card: Awaited<ReturnType<typeof getUserWatchlistCards>>[0] }) {
  const changeColor =
    card.changeRate === null ? "text-navy/30" :
    card.changeRate > 0 ? "text-gold-700" :
    card.changeRate < 0 ? "text-red-600" :
    "text-navy/40";

  const href = card.slug ? `/cards/${card.slug}` : `/cards/${card.cardId}`;

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-navy/[0.02] transition">
      <div className="flex-1 min-w-0">
        <Link href={href} className="font-medium text-navy hover:text-gold-700 transition truncate block">
          {card.cardName}
        </Link>
        <p className="text-xs text-navy/45 truncate">{card.rarity} · {card.setName}</p>
      </div>
      <div className="shrink-0 text-right space-y-0.5">
        <p className="text-sm tabular-nums font-medium text-navy">
          {card.latestPrice !== null && card.currency
            ? formatPrice(card.latestPrice, card.currency)
            : <span className="text-navy/30">—</span>
          }
        </p>
        <p className={`text-xs tabular-nums ${changeColor}`}>
          {card.changeRate !== null
            ? `${card.changeRate > 0 ? "▲" : card.changeRate < 0 ? "▼" : ""}${Math.abs(card.changeRate).toFixed(1)}%`
            : "—"
          }
        </p>
      </div>
    </div>
  );
}
