'use client';

import { useState } from 'react';

/**
 * X の文字数カウント（近似）:
 *   - URL は長さに関わらず 23
 *   - ASCII は 1、それ以外（日本語・絵文字等）は 2
 * 上限は 280（全角のみなら約140文字）。
 */
function weightedLength(text: string): number {
  const URL_RE = /https?:\/\/\S+/g;
  const urls = text.match(URL_RE) ?? [];
  let n = urls.length * 23;
  for (const ch of text.replace(URL_RE, '')) {
    n += (ch.codePointAt(0) ?? 0) <= 0x7f ? 1 : 2;
  }
  return n;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const len = weightedLength(text);
  const over = len > 280;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // clipboard 不許可時は選択コピーしてもらう
            alert('コピーできませんでした。文面を選択してコピーしてください。');
          }
        }}
        className="bg-navy text-white px-4 py-2 text-sm font-semibold rounded-sm hover:bg-navy/80 transition"
      >
        {copied ? '✓ コピーしました' : '文面をコピー'}
      </button>
      <span className={`text-xs tabular-nums ${over ? 'text-red-600 font-semibold' : 'text-navy/40'}`}>
        {len} / 280{over ? '（超過！短くしてください）' : ''}
      </span>
    </div>
  );
}
