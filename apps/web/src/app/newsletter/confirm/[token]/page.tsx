import { confirmSubscription } from "@gci/core";
import Link                    from "next/link";
import type { Metadata }       from "next";

export const metadata: Metadata = {
  title:  "購読確認",
  robots: { index: false },   // 確認ページはインデックス不要
};

export default async function ConfirmPage({
  params,
}: {
  params: { token: string };
}) {
  const result = await confirmSubscription(params.token);

  // ── 成功 ─────────────────────────────────────────────────────
  if (result.ok) {
    return (
      <ConfirmLayout>
        <p className="text-4xl mb-4">🎉</p>
        <h1 className="text-2xl font-semibold text-navy mb-3">購読完了！</h1>
        <p className="text-navy/60 leading-relaxed mb-6">
          ご登録ありがとうございます。<br />
          明朝から GCI Daily Recap をお届けします。
        </p>
        <Link
          href="/daily"
          className="inline-block border border-navy bg-navy px-6 py-3 text-sm text-white hover:bg-navy/90 transition"
        >
          最新の市場まとめを見る →
        </Link>
      </ConfirmLayout>
    );
  }

  // ── 既に確認済み ─────────────────────────────────────────────
  if (result.error === "already_confirmed") {
    return (
      <ConfirmLayout>
        <p className="text-4xl mb-4">✅</p>
        <h1 className="text-2xl font-semibold text-navy mb-3">すでに購読中です</h1>
        <p className="text-navy/60 mb-6">
          このアドレスはすでに購読が有効になっています。
        </p>
        <Link href="/daily" className="text-sm text-navy/50 hover:text-navy underline">
          最新の市場まとめを見る
        </Link>
      </ConfirmLayout>
    );
  }

  // ── 退会済み ─────────────────────────────────────────────────
  if (result.error === "unsubscribed") {
    return (
      <ConfirmLayout>
        <p className="text-4xl mb-4">😴</p>
        <h1 className="text-2xl font-semibold text-navy mb-3">退会済みのアドレスです</h1>
        <p className="text-navy/60 mb-6">
          再度購読するには登録ページからお申し込みください。
        </p>
        <Link
          href="/newsletter"
          className="inline-block border border-navy bg-navy px-6 py-3 text-sm text-white hover:bg-navy/90 transition"
        >
          再登録する
        </Link>
      </ConfirmLayout>
    );
  }

  // ── 無効なトークン ────────────────────────────────────────────
  return (
    <ConfirmLayout>
      <p className="text-4xl mb-4">❌</p>
      <h1 className="text-2xl font-semibold text-navy mb-3">リンクが無効です</h1>
      <p className="text-navy/60 mb-6">
        確認リンクの有効期限が切れているか、URLが正しくありません。<br />
        もう一度登録し直してください。
      </p>
      <Link
        href="/newsletter"
        className="inline-block border border-navy bg-navy px-6 py-3 text-sm text-white hover:bg-navy/90 transition"
      >
        登録ページへ
      </Link>
    </ConfirmLayout>
  );
}

function ConfirmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="mb-6 text-xs uppercase tracking-widest text-navy/30">
        Global Card Index — Newsletter
      </p>
      {children}
    </div>
  );
}
