/**
 * /admin/extension
 *
 * GCI Mercari Collector Chrome 拡張のインストール説明ページ
 */

export const dynamic = "force-dynamic";

export default function ExtensionPage() {
  return (
    <div className="space-y-10 max-w-2xl">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin › Extension</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">GCI Mercari Collector</h1>
        <p className="mt-1 text-sm text-navy/50">
          Mercari 売切れページを開いてボタン1押しで価格を自動取込む Chrome 拡張です。
        </p>
      </header>

      {/* ── インストール手順 ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-navy/40">インストール手順</h2>

        <ol className="space-y-4">
          {[
            {
              n: 1,
              title: "拡張フォルダを確認",
              body: (
                <>
                  リポジトリの <code className="rounded bg-navy/10 px-1.5 py-0.5 text-xs font-mono">extension/</code> フォルダを用意します。
                  <br />含まれるファイル：<code className="text-xs font-mono">manifest.json</code>、
                  <code className="text-xs font-mono">popup.html</code>、
                  <code className="text-xs font-mono">popup.js</code>
                </>
              ),
            },
            {
              n: 2,
              title: "Chrome の拡張機能管理ページを開く",
              body: (
                <>
                  Chrome アドレスバーに{" "}
                  <code className="rounded bg-navy/10 px-1.5 py-0.5 text-xs font-mono">chrome://extensions</code>{" "}
                  を入力して開きます。
                </>
              ),
            },
            {
              n: 3,
              title: "デベロッパーモードを ON",
              body: "右上の「デベロッパーモード」スイッチをオンにします。",
            },
            {
              n: 4,
              title: "「パッケージ化されていない拡張機能を読み込む」",
              body: (
                <>
                  左上に表示されるボタンをクリックし、リポジトリ内の{" "}
                  <code className="rounded bg-navy/10 px-1.5 py-0.5 text-xs font-mono">extension/</code>{" "}
                  フォルダを選択します。
                </>
              ),
            },
            {
              n: 5,
              title: "API Key を設定",
              body: (
                <>
                  拡張アイコンをクリック → ⚙ アイコン →
                  Vercel の環境変数 <code className="rounded bg-navy/10 px-1.5 py-0.5 text-xs font-mono">CRON_SECRET</code>{" "}
                  の値を貼り付けて保存。
                </>
              ),
            },
          ].map(({ n, title, body }) => (
            <li key={n} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                {n}
              </span>
              <div className="pt-0.5">
                <p className="font-medium text-navy">{title}</p>
                <p className="mt-1 text-sm text-navy/60 leading-relaxed">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 使い方 ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-navy/40">使い方</h2>
        <div className="rounded-lg border border-navy/10 bg-white p-5 space-y-3 text-sm text-navy/70 leading-relaxed">
          <p>1. メルカリでカード名を検索 → フィルターで <strong className="text-navy">「売り切れ」</strong> に絞る</p>
          <p>2. Chrome ツールバーの <strong className="text-navy">GCI アイコン</strong> をクリック</p>
          <p>3. 自動検出されたキーワードで GCI カードが表示される → 対象カードを選択</p>
          <p>4. <strong className="text-navy">「収集する」</strong> ボタンをクリック</p>
          <p>5. 現在のページの全アイテムが取込まれ、matchScore ≥ 75 は即座に Price 化される</p>
          <p className="text-navy/40 text-xs">※ 次のページも収集したい場合はページを移動して再度ボタンを押してください</p>
        </div>
      </section>

      {/* ── 動作確認 ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-navy/40">収集後の確認</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <a href="/admin/prices/inbox"
             className="rounded-lg border border-navy/10 bg-white p-4 hover:bg-navy/[0.02] transition">
            <p className="font-medium text-navy">Inbox</p>
            <p className="mt-0.5 text-xs text-navy/50">取込済みデータの確認・手動承認</p>
          </a>
          <a href="/admin/logs"
             className="rounded-lg border border-navy/10 bg-white p-4 hover:bg-navy/[0.02] transition">
            <p className="font-medium text-navy">Cron Logs</p>
            <p className="mt-0.5 text-xs text-navy/50">自動収集の実行状況</p>
          </a>
        </div>
      </section>
    </div>
  );
}
