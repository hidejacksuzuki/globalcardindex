# β ローンチ実行コマンド集

> このファイルは Week 24 完了時点での「次にターミナルで打つコマンド」をまとめたものです。
> 上から順に実行してください。

---

## Step 1: ビルドチェック

```bash
# モノレポルートで実行
cd /path/to/global-card-index

pnpm install          # 念のため依存解決
pnpm build            # 全パッケージビルド (apps/web + apps/data + packages/*)
```

エラーがある場合は修正してから次に進む。

---

## Step 2: DB マイグレーション（Week 23 — 必須）

```bash
# User.email を String → String? に変更したマイグレーション
pnpm --filter @gci/db prisma migrate dev --name "user-email-nullable"

# 本番 DB への適用（Vercel / Railway / Supabase など）
pnpm --filter @gci/db prisma migrate deploy
```

> ⚠️ `User.email` を nullable にするマイグレーションは既存データに影響しません
> （既存 email は null に変わらない）

---

## Step 3: git コミット

```bash
git add .
git commit -m "feat: Week 23-24 — user accounts, persistent watchlist, beta launch polish

Week 23: User Accounts & Persistent Watchlist
- Add Auth.js v5 magic-link auth (Resend provider, PrismaAdapter)
- Add /login, /login/verify, /account pages
- Add UserWatchlistItem + NotificationPrefs Prisma models
- WatchButton dual-mode: DB for authenticated, cookie for anonymous
- POST /api/v1/watchlist/migrate — cookie watchlist → DB migration
- PATCH /api/v1/account/prefs — per-user notification preferences
- Rewrite watchlist-alerts cron for per-user personalized emails
- Fix User.email to String? per @auth/prisma-adapter requirement

Week 24: Beta Launch Polish
- Add scripts/smoke-test.sh — production endpoint health checker
- Polish login/account/MigrateBanner/NotifPrefsForm Japanese copy
- Improve magic-link email HTML (cleaner layout, better text version)
- Add X-Robots-Tag + Cache-Control headers for /login /account /api/auth
- Add data/BETA_INVITE.md — invite email, Discord welcome, feedback template
- Update BETA_CHECKLIST.md — Week 24 closed beta launch checklist (§7)"

git push origin main
```

---

## Step 4: Vercel 環境変数セット（web app）

Vercel ダッシュボード → web app → Settings → Environment Variables:

```
AUTH_SECRET       = <openssl rand -base64 32 の出力>
AUTH_RESEND_KEY   = re_xxxxxxxxxxxx    (Resend API Key)
RESEND_FROM_EMAIL = GCI <noreply@globalcardindex.com>
```

---

## Step 5: 本番デプロイ後スモークテスト

```bash
# 基本チェック（公開ページ・ヘルス・noindex・セキュリティヘッダー）
BASE_URL=https://globalcardindex.com \
DATA_URL=https://data.globalcardindex.com \
./scripts/smoke-test.sh

# Cron dry-run も含むフルチェック
BASE_URL=https://globalcardindex.com \
DATA_URL=https://data.globalcardindex.com \
CRON_SECRET=<your-cron-secret> \
./scripts/smoke-test.sh
```

全 PASS を確認してから招待メールを送付する。

---

## Step 6: magic-link 実送信テスト

1. ブラウザで `https://globalcardindex.com/login` を開く
2. 自分のメールアドレスを入力して送信
3. メールを受信 → リンクをクリック → `/account` に着地することを確認
4. `/account` でウォッチリスト・通知設定が表示されることを確認
5. カード詳細ページで Watch ボタンを押す → `/account` にそのカードが出ることを確認

---

## Step 7: アラート・cron テスト

```bash
# watchlist-alerts: dry-run（ターゲットユーザー数・カード数の確認）
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://data.globalcardindex.com/api/v1/cron/watchlist-alerts?dry=1"

# watchlist-alerts: 自分あてテスト送信
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://data.globalcardindex.com/api/v1/cron/watchlist-alerts?test=your@email.com"

# weekly-recap: dry-run
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://data.globalcardindex.com/api/v1/cron/weekly-recap?dry=1"
```

---

## Step 8: β招待送付

`data/BETA_INVITE.md` の招待メール（§1）を使用:

1. `[DISCORD_INVITE_URL]` を実際の URL に置き換える
2. 宛先ごとに氏名を入れて送付
3. `data/BETA_INVITE.md` §6 の送付ログに記録

---

## Step 9: 監視体制

```bash
# 毎朝確認: Vercel ログ（Error タブ）
open https://vercel.com/dashboard

# Plausible: /login, /account のページビュー
open https://plausible.io

# Discord #feedback チャンネル
open https://discord.gg/[your-invite]
```
