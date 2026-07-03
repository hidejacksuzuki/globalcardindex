# β公開前チェックリスト

公開 Go/NoGo の判断に使う。全項目 ✅ になったら公開してよい。
（最終更新: 2026-07-03）

## A. 技術面

- [x] 全テーブル RLS 有効化（2026-07-01 適用済み）
- [x] pending migration ゼロ（recalc_log_failures / beta_feedback 適用済み）
- [x] `pnpm build`（web）が通る
- [x] 型エラーゼロ（core / web / data）
- [x] 本番スモークテスト通過（`./scripts/smoke-test.sh`）
- [x] シークレットローテーション完了（POSTGRES_PASSWORD / JWT / SECRET_KEY）
- [ ] Vercel の `NEXT_PUBLIC_BASE_URL` が本番URLで設定されているか確認
- [ ] recalc cron が直近24時間エラーなし（/admin/logs の Recalc Stability）
- [ ] fetch cron が直近24時間で価格を収集できている

## B. ユーザー動線（ブラウザで手動確認）

- [ ] トップ → カード検索 → カード詳細 が迷わず辿れる
- [ ] カード詳細に推定相場・価格推移・ソース別相場が表示される（データありカード）
- [ ] 未ログインで「ログインしてPortfolioに追加」→ ログイン → 元のカードに戻る
- [ ] Quick Add で Portfolio に追加 → /portfolio に反映
- [ ] Portfolio の編集（枚数・取得単価・グレード・メモ）と削除
- [ ] Watchlist の Quick Add ボタン → Portfolio 転換
- [ ] β Feedback ボタン → 送信 → /admin/feedback に届く
- [ ] モバイル幅（375px）でヘッダー・テーブル・モーダルが崩れない
- [ ] EN ロケール（/en/...）で主要ページが表示される

## C. 運営準備

- [ ] /admin/feedback を毎日見る運用の確認（RUNBOOK 参照）
- [ ] 利用規約 / 免責の文言確認（価格は参考値・投資助言でない旨）
- [ ] Newsletter 配信テスト（dry-run: `CRON_SECRET=xxx ./scripts/smoke-test.sh`）
- [ ] Discord 通知が届くことを確認
- [ ] 障害時の連絡先・対応フロー（= RUNBOOK）を一読

## D. 公開直後（Day 1）

- [ ] smoke-test.sh を実行して全パス
- [ ] /admin/logs で cron が正常稼働
- [ ] /admin/portfolio で最初の登録を観測
- [ ] Feedback の初回トリアージ
