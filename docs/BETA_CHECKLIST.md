# β公開前チェックリスト

公開 Go/NoGo の判断に使う。全項目 ✅ になったら公開してよい。
（最終更新: 2026-07-04）

## A. 技術面

- [x] 全テーブル RLS 有効化（2026-07-01 適用済み）
- [x] pending migration ゼロ（recalc_log_failures / beta_feedback 適用済み）
- [x] `pnpm build`（web）が通る
- [x] 型エラーゼロ（core / web / data）
- [x] 本番スモークテスト通過（`./scripts/smoke-test.sh` — 2026-07-04 全パス）
- [x] シークレットローテーション完了（POSTGRES_PASSWORD / JWT / SECRET_KEY）
- [x] メールログイン基盤（Resend ドメイン検証・マジックリンク送受信・サインイン成功 2026-07-04）
- [x] `NEXT_PUBLIC_BASE_URL` — 空でもコード側フォールバックで安全（`||` 修正済み）
- [ ] recalc cron が直近24時間エラーなし（/admin/logs の Recalc Stability）
- [ ] fetch cron が直近24時間で価格を収集できている

## B. ユーザー動線（ブラウザで手動確認）

- [x] トップ → カード検索 → カード詳細 が辿れる（※入口の分かりにくさは改善候補: 一覧の行全体クリック化）
- [x] カード詳細に相場情報が表示される（データありカードで確認）
- [x] 未ログインCTA → メールログイン → サインイン完了（2026-07-04 本番で確認）
- [x] Quick Add で Portfolio に追加 → /portfolio に反映
- [x] Portfolio の編集（枚数・取得単価・グレード・メモ）と削除
- [x] Watchlist の Quick Add ボタン → Portfolio 転換
- [x] β Feedback ボタン → 送信 → /admin/feedback に届く（ステータス変更も可）
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
