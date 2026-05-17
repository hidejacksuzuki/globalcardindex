/**
 * Shared disclaimer banner.
 *
 * Variants:
 *   "inline"  — compact single-line note for card detail pages
 *   "banner"  — full-width expandable banner for list pages
 *   "footer"  — small footer note
 */

type DisclaimerVariant = "inline" | "banner" | "footer";

export function Disclaimer({ variant = "banner" }: { variant?: DisclaimerVariant }) {
  if (variant === "inline") {
    return (
      <p className="text-[11px] text-navy/40 border-t border-navy/5 pt-3 mt-3">
        ※ 本ページの価格・指数は外部マーケットの参考集計です。
        投資助言・価格保証ではありません。
        <a href="/terms" className="underline underline-offset-2 hover:text-navy/60 ml-1">
          利用規約
        </a>
      </p>
    );
  }

  if (variant === "footer") {
    return (
      <p className="text-[11px] text-navy/30 text-center">
        価格データは外部マーケットの参考集計です。投資助言・価格保証ではありません。
        {" "}
        <a href="/terms" className="underline underline-offset-2 hover:text-navy/50">
          利用規約
        </a>
      </p>
    );
  }

  // banner (default)
  return (
    <aside className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
      <p>
        <span className="font-semibold">参考値について：</span>
        本サービスの価格・指数データはメルカリ等の外部マーケットから収集した参考情報です。
        投資助言・売買推奨・価格保証を目的とするものではありません。
        掲載情報の正確性・完全性を保証するものでもありません。
        {" "}
        <a href="/terms" className="underline underline-offset-2 font-medium hover:text-amber-900">
          詳細は利用規約
        </a>
      </p>
    </aside>
  );
}

/**
 * Confidence explanation callout — explains what HIGH/MED/LOW/参考値 means.
 * Used on home page and in cards listing header.
 */
export function ConfidenceExplainer() {
  return (
    <aside className="rounded border border-navy/10 bg-navy/[0.02] px-5 py-4 text-xs text-navy/60 space-y-2">
      <p className="font-semibold text-navy/80 text-sm">信頼度（Confidence）について</p>
      <p>
        各カードの指数値には収集サンプル数・外れ値率に基づく信頼度を付与しています。
      </p>
      <div className="flex flex-wrap gap-3 pt-1">
        <ConfidenceTip tier="HIGH" label="HIGH"
          desc="サンプル10件以上・外れ値率20%未満。信頼できる指数値です。" />
        <ConfidenceTip tier="MED"  label="MED"
          desc="サンプル3件以上。参考として有効ですが変動があります。" />
        <ConfidenceTip tier="LOW"  label="LOW / 参考値"
          desc="サンプルが少なく精度が限定的です。目安としてご利用ください。" />
      </div>
    </aside>
  );
}

function ConfidenceTip({
  tier, label, desc,
}: { tier: "HIGH" | "MED" | "LOW"; label: string; desc: string }) {
  const styles: Record<string, string> = {
    HIGH: "bg-green-100 text-green-700",
    MED:  "bg-amber-100 text-amber-700",
    LOW:  "bg-red-100 text-red-600",
  };
  return (
    <div className="flex items-start gap-2 min-w-[200px] max-w-xs">
      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[tier]}`}>
        {label}
      </span>
      <span>{desc}</span>
    </div>
  );
}
