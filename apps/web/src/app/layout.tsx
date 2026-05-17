import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Disclaimer } from "@/components/common/Disclaimer";
import { PlausibleAnalytics } from "@/components/analytics/PlausibleAnalytics";

const inter = Inter({ subsets: ["latin"] });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default:  "Global Card Index",
    template: "%s | GCI",
  },
  description:
    "トレーディングカード市場の価格透明性インフラ。指数・マーケットボード・カード別相場を提供。",
  openGraph: {
    siteName: "Global Card Index",
    type:     "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  // RSS auto-discovery — ブラウザ・RSS リーダーが自動検出
  alternates: {
    types: {
      "application/rss+xml": `${BASE_URL}/feed.xml`,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} text-navy`}>
        <PlausibleAnalytics />
        <Header />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="border-t border-navy/10 bg-white mt-16">
          <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">

            {/* Retention row: Discord + Newsletter */}
            {process.env.NEXT_PUBLIC_DISCORD_INVITE && (
              <div className="flex flex-wrap items-center gap-4 rounded border border-navy/10 bg-navy/[0.02] px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-navy/70 uppercase tracking-widest">Community</p>
                  <p className="text-sm text-navy/60 mt-0.5">市場アラートや週次まとめは Discord と Newsletter で受け取れます。</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <a
                    href={process.env.NEXT_PUBLIC_DISCORD_INVITE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-indigo-400 px-4 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
                  >
                    Discord 参加
                  </a>
                  <a
                    href="/newsletter"
                    className="rounded border border-navy/20 px-4 py-1.5 text-xs font-medium text-navy/60 transition hover:border-navy/40 hover:text-navy"
                  >
                    Newsletter 登録
                  </a>
                </div>
              </div>
            )}

            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-navy/50">
              <a href="/" className="hover:text-navy transition">Home</a>
              <a href="/marketboard" className="hover:text-navy transition">Marketboard</a>
              <a href="/cards" className="hover:text-navy transition">Cards</a>
              <a href="/most-requested" className="hover:text-navy transition">Most Requested</a>
              <a href="/games" className="hover:text-navy transition">Games</a>
              <a href="/daily" className="hover:text-navy transition">Daily</a>
              <a href="/indices" className="hover:text-navy transition">Indices</a>
              <a href="/newsletter" className="hover:text-navy transition">Newsletter</a>
              <a href="/about" className="hover:text-navy transition">About</a>
              <a href="/beta" className="hover:text-navy transition">β参加</a>
              <a href="/terms" className="hover:text-navy transition font-medium">利用規約</a>
            </nav>
            <Disclaimer variant="footer" />
          </div>
        </footer>
      </body>
    </html>
  );
}
