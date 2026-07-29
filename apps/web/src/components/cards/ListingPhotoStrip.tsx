"use client";

/**
 * ListingPhotoStrip — カードページ「実際の出品写真」ストリップ
 *
 * B案（2026-07-08）: 公式カードアートの代わりに、収集済み出品データの
 * 出品者写真をホットリンク（表示のみ）で並べる。再ホストはしない。
 *
 * - 素の <img> で lazy 読み込み + no-referrer（越境ブロック緩和・プライバシー配慮）
 * - CDN URL 失効で 404 になった画像は onError で黙って非表示にする
 * - 各写真は出品ページへ rel="nofollow noopener" でリンク
 * - 画像の帰属表記を必ず添える（GCI は表示しているだけ、という立て付け）
 */

import { useState } from "react";
import { useT }     from "@/i18n/context";

type Photo = {
  imageUrl:   string;
  source:     string;
  listingUrl: string | null;
};

/** ヤフオクのみロケール依存（en では "Yahoo Auctions"）。他はブランド名共通。 */
function sourceLabel(source: string, yahooLabel: string): string {
  const map: Record<string, string> = {
    mercari_sold:         "Mercari",
    mercari_listing:      "Mercari",
    mercari:              "Mercari",
    yahoo_auction_closed: yahooLabel,
    yahoo_auction_active: yahooLabel,
    yahuoku:              yahooLabel,
    ebay:                 "eBay",
  };
  return map[source] ?? source;
}

export function ListingPhotoStrip({ photos }: { photos: Photo[] }) {
  // 失効（404）した画像 URL を覚えて表示から外す
  const [dead, setDead] = useState<Set<string>>(new Set());
  const t       = useT().cardDetail;
  const label   = (source: string) => sourceLabel(source, t.sourceYahoo);
  const visible = photos.filter((p) => !dead.has(p.imageUrl));

  if (visible.length === 0) return null;

  return (
    <section className="border border-navy/10 bg-white p-6">
      <h2 className="text-xs uppercase tracking-widest text-navy/50 mb-4">{t.photosTitle}</h2>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {visible.map((p) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element -- 意図的に最適化せず表示のみ（再ホスト回避）
            <img
              src={p.imageUrl}
              alt={`${label(p.source)}${t.photosAlt}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() =>
                setDead((prev) => {
                  const next = new Set(prev);
                  next.add(p.imageUrl);
                  return next;
                })
              }
              className="aspect-square w-full object-cover border border-navy/10 bg-navy/5 transition group-hover:opacity-90"
            />
          );

          return (
            <figure key={p.imageUrl} className="space-y-1">
              {p.listingUrl ? (
                <a
                  href={p.listingUrl}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="group block"
                >
                  {img}
                </a>
              ) : (
                img
              )}
              <figcaption className="text-center text-[10px] text-navy/40">
                {label(p.source)}
              </figcaption>
            </figure>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-navy/35">
        {t.photosAttribution}
      </p>
    </section>
  );
}
