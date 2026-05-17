/**
 * /login/verify
 *
 * "Check your email" holding page shown after magic-link is sent.
 * Auth.js redirects here via pages.verifyRequest config.
 */

import type { Metadata } from "next";
import Link              from "next/link";

export const metadata: Metadata = {
  title:  "メールを確認 | Global Card Index",
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 px-4 py-20 text-center sm:px-0">
      <div className="text-4xl">📧</div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-navy">メールを確認してください</h1>
        <p className="text-sm text-navy/60">
          ログインリンクをメールでお送りしました。<br />
          メールボックスを確認してリンクをクリックしてください。
        </p>
      </div>

      <div className="rounded border border-navy/10 bg-navy/[0.02] px-4 py-4 text-left text-xs text-navy/50 space-y-1">
        <p>• リンクの有効期限は <strong className="text-navy/70">10分間</strong> です</p>
        <p>• 迷惑メールフォルダも確認してください</p>
        <p>• 届かない場合は再度メールアドレスを入力してください</p>
      </div>

      <Link
        href="/login"
        className="inline-block text-xs text-navy/50 underline hover:text-navy transition"
      >
        ← ログインページに戻る
      </Link>
    </div>
  );
}
