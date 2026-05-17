import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";

const inter = Inter({ subsets: ["latin"] });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default:  "Global Card Index",
    template: "%s | GCI",
  },
  description:
    "Price transparency infrastructure for trading cards. Indices, marketboard, and read APIs.",
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
        <Header />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
