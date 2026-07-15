"use client";

/**
 * CardThumb — 一覧用の小さなカードサムネイル
 *
 * src があれば出品写真（ホットリンク・表示のみ）を表示し、
 * 無い／失効した場合はカード名の頭文字プレースホルダにフォールバックする。
 * マーケットムーバー等のリスト行で使う。
 */

import { useState } from "react";

export function CardThumb({
  src,
  char,
}: {
  src?: string | null;
  char: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = !!src && !failed;

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-navy/5 text-[10px] font-bold text-navy/30">
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- 意図的に最適化せず表示のみ（再ホスト回避）
        <img
          src={src!}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        char
      )}
    </div>
  );
}
