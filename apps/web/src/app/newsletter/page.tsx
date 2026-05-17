import type { Metadata }    from "next";
import { SubscribeForm }    from "@/components/newsletter/SubscribeForm";

export const metadata: Metadata = {
  title:       "Newsletter",
  description: "トレカ市場の日次まとめを毎朝メールでお届けします。無料・いつでも退会可能。",
};

export default function NewsletterPage() {
  return (
    <div className="mx-auto max-w-xl py-16">
      {/* ── ヘッダー ── */}
      <div className="mb-10 text-center">
        <p className="mb-2 text-xs uppercase tracking-widest text-navy/40">Newsletter</p>
        <h1 className="text-3xl font-semibold text-navy">
          毎朝届くトレカ市況
        </h1>
        <p className="mt-4 text-navy/60 leading-relaxed">
          GCI Daily Recap をメールでお届けします。<br />
          高騰・暴落・出品急増・指数変動を毎朝確認。
        </p>
      </div>

      {/* ── 特徴 ── */}
      <div className="mb-10 grid grid-cols-3 gap-4 text-center text-sm">
        {[
          { icon: "📊", label: "毎朝配信", desc: "1:00 JST" },
          { icon: "🆓", label: "無料",    desc: "登録不要" },
          { icon: "🚪", label: "退会自由", desc: "ワンクリック" },
        ].map(({ icon, label, desc }) => (
          <div key={label} className="border border-navy/10 bg-white p-4">
            <p className="text-2xl">{icon}</p>
            <p className="mt-2 font-medium text-navy">{label}</p>
            <p className="text-xs text-navy/40">{desc}</p>
          </div>
        ))}
      </div>

      {/* ── 登録フォーム ── */}
      <SubscribeForm />

      {/* ── 法的事項 ── */}
      <p className="mt-8 text-center text-xs text-navy/30 leading-relaxed">
        登録後、確認メールを送信します（ダブルオプトイン）。<br />
        確認リンクをクリックするまで配信は開始されません。<br />
        個人情報はニュースレター配信のみに使用します。
      </p>
    </div>
  );
}
