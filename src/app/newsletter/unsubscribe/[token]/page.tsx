import { unsubscribe }      from "@/actions/newsletter";
import Link                 from "next/link";
import type { Metadata }    from "next";

export const metadata: Metadata = {
  title:  "配信停止",
  robots: { index: false },
};

export default async function UnsubscribePage({
  params,
}: {
  params: { token: string };
}) {
  const result = await unsubscribe(params.token);

  // ── 成功 ─────────────────────────────────────────────────────
  if (result.ok) {
    return (
      <UnsubLayout>
        <p className="text-4xl mb-4">👋</p>
        <h1 className="text-2xl font-semibold text-navy mb-3">配信停止が完了しました</h1>
        <p className="text-navy/60 leading-relaxed mb-6">
          ニュースレターの配信を停止しました。<br />
          またいつでも再登録できます。
        </p>
        <Link
          href="/newsletter"
          className="text-sm text-navy/50 hover:text-navy underline"
        >
          再度購読する
        </Link>
      </UnsubLayout>
    );
  }

  // ── 既に退会済み ─────────────────────────────────────────────
  if (result.error === "already_unsubscribed") {
    return (
      <UnsubLayout>
        <p className="text-4xl mb-4">✅</p>
        <h1 className="text-2xl font-semibold text-navy mb-3">すでに配信停止済みです</h1>
        <p className="text-navy/60 mb-4">
          このアドレスへの配信はすでに停止されています。
        </p>
      </UnsubLayout>
    );
  }

  // ── 無効なトークン ────────────────────────────────────────────
  return (
    <UnsubLayout>
      <p className="text-4xl mb-4">❌</p>
      <h1 className="text-2xl font-semibold text-navy mb-3">リンクが無効です</h1>
      <p className="text-navy/60 mb-6">
        URLが正しくないか、すでに処理済みです。<br />
        問題が続く場合はお問い合わせください。
      </p>
    </UnsubLayout>
  );
}

function UnsubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="mb-6 text-xs uppercase tracking-widest text-navy/30">
        Global Card Index — Newsletter
      </p>
      {children}
      <p className="mt-10 text-xs text-navy/20">
        このページは配信停止リンクからアクセスされました。
      </p>
    </div>
  );
}
