import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default:  "GCI Data",
    template: "%s | GCI Data",
  },
  description: "GCI 内部管理・データ収集プラットフォーム",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-surface-muted text-navy min-h-screen`}>
        <header className="border-b border-surface-border bg-white px-6 py-3">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-navy/50">
              GCI Data — Internal
            </span>
            <nav className="flex gap-4 text-xs text-navy/40">
              <a href="/admin/prices"       className="hover:text-navy">Prices</a>
              <a href="/admin/sources"      className="hover:text-navy">Sources</a>
              <a href="/admin/index"        className="hover:text-navy">Index</a>
              <a href="/admin/logs"         className="hover:text-navy">Logs</a>
              <a href="/admin/distribution" className="hover:text-navy">Distribution</a>
              <a href="/admin/newsletter"   className="hover:text-navy">Newsletter</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
