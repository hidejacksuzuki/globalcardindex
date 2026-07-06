# GCI 運用 RUNBOOK

日々の運用手順と、過去に実際に起きた障害の対処法。
困ったらまずここを見る（Claude Code に「RUNBOOK を見て」と言えば読んでくれる）。

---

## 1. 毎日の基本オペレーション

### 開発を始めるとき

```bash
cd "/Users/suzukihidenobu/Documents/Claude/Projects/Global Card Index"
./scripts/dev-restart.sh        # ポート解放 + env診断
pnpm dev:web                    # ターミナル1
pnpm dev:data                   # ターミナル2（別ウィンドウ）
./scripts/smoke-test.sh local   # 両方 Ready になったら動作確認
```

### デプロイ後の確認

```bash
./scripts/smoke-test.sh         # 本番スモークテスト
```

### 管理画面クイックリンク（要 Basic Auth）

| ページ | URL | 見るもの |
|---|---|---|
| Cron 健全性 | https://www.gci-data.com/admin/logs | Recalc Stability・failure rate・stale cards |
| 価格承認 | https://www.gci-data.com/admin/prices/inbox | 承認待ち価格 |
| Portfolio 分析 | https://www.gci-data.com/admin/portfolio | 登録数・grade比率・転換率 |
| Feedback | https://www.gci-data.com/admin/feedback | Open 件数 → トリアージ |
| カードリクエスト | https://www.gci-data.com/admin/card-requests | Pending 確認 |

---

## 2. 障害対応（実際に起きた事例）

### 症状: `EADDRINUSE: address already in use :::3000`

前のプロセスがポートを掴んだまま。

```bash
./scripts/dev-restart.sh --kill-only
```

### 症状: `Can't reach database server at ...:5432`

env の接続文字列に問題がある。**中身を目で見る前に**まず:

```bash
./scripts/env-doctor.sh
```

過去の原因（2026-07 に全部実際に起きた）:
- ルートの `.env.local` しかなく、`apps/web/.env.local` が存在しなかった
  → Next.js はアプリディレクトリ内の env しか読まない。`cp .env.local apps/web/.env.local`
- `vercel env pull` で取得した値が空だった（Vercel の Sensitive 変数は pull できない）
  → Supabase Connect → ORM タブから手動で設定
- パスワードに記号 `( ) , ?` が含まれ、URL エンコードされていなかった
  → `python3` の `urllib.parse.quote()` でエンコードしてから貼る
- 編集時にプロジェクト参照 `postgres.cjwucwrxlaxmtkleyrxx:` の部分を誤って消した
  → env-doctor が「区切り : がない」と検出する
- Direct connection (`db.<ref>.supabase.co:5432`) は IPv6 必須で、IPv4 回線からは繋がらない
  → 必ず pooler (`aws-1-us-east-1.pooler.supabase.com`) を使う
    - `DATABASE_URL` = ポート **6543** + `?pgbouncer=true`
    - `DIRECT_URL` = ポート **5432**（pgbouncer なし）

### 症状: `Invalid URL` で全ページ 500

`NEXT_PUBLIC_BASE_URL` が空文字。修正済み（`??` → `||`）だが、
Vercel の環境変数に空文字を設定しないこと。

### 症状: admin が `The column "X" does not exist in the current database`

migration SQL は Supabase SQL Editor で実行したはずなのに反映されていない。
実際に 2026-07-03 に発生: `portfolio_grade` / `recalc_log_failures` /
`beta_feedback` の3つとも「Success」表示があったにもかかわらず未適用だった
（別プロジェクトに実行していた、または反映前の画面を見ていた可能性）。

確認方法（値は表示せず安全に確認できる）:
```bash
DIR_URL=$(grep '^DIRECT_URL=' apps/data/.env.local | sed -E 's/^DIRECT_URL="(.*)"$/\1/')
psql "$DIR_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'PortfolioCard';"
```
列が無ければ、Claude Code に `psql "$DIR_URL" -f packages/db/prisma/migrations/<name>/migration.sql`
を実行してもらう（ユーザーの明示的な確認を得てから）。SQL Editor 経由より確実。

### smoke-test.sh 自体が信用できないとき

`echo "$var" | grep -q pattern` は、pattern が長い出力の先頭付近でマッチすると
grep が早期にパイプを閉じ、書き込み側が SIGPIPE を受けて `pipefail` 下で
「マッチしたのに失敗」判定になることがある（sitemap.xml で実際に発生・2026-07-03に修正済み）。
今後 smoke-test.sh を編集するときは `grep -q pattern <<< "$var"`（herestring）を使うこと。
`echo | grep -q` の形は書かない。

### 症状: 本番 admin が 401

正常。Basic Auth（ADMIN_USER / ADMIN_PASSWORD）で保護している意図した設計。

### 症状: push したのに gci-data（管理画面）に反映されない

2026-07-04 に発生。git push で gci-web はデプロイされるのに、gci-data には
デプロイ記録すら作られないことがある（Ignored Build Step は Automatic で問題なし、
原因未特定）。回避策 — CLI から手動デプロイ:

```bash
cd "/Users/suzukihidenobu/Documents/Claude/Projects/Global Card Index"
npx vercel link --yes --project gci-data
npx vercel --prod
```

デプロイ後の反映確認: `curl -s -o /dev/null -w "%{http_code}" https://www.gci-data.com/api/v1/admin/feedback/test`
が **405** なら新コード（404 なら旧コードのまま）。

**教訓（2026-07-04 の feedback 不達事件）**: 「管理画面にデータが出ない」ときは
①送信自体の成否をDBで確認 → ②管理画面側のデプロイが最新か → ③管理画面側の
環境変数（gci-data の DATABASE_URL は gci-web とは別管理！）の順で切り分ける。
このときは②（未デプロイ）と③（DATABASE_URL が46日前の旧パスワードのまま）の
両方が原因だった。パスワードローテーション時は **gci-web と gci-data の両方**の
環境変数更新を忘れないこと。

### 症状: X投稿が `402 CreditsDepleted` で失敗する

X API はプリペイドのクレジット制。開発者アカウントの残高が切れると
朝・昼・夜の自動投稿がすべて失敗する（キーや権限の問題ではない）。

対処: https://developer.x.com/ にログイン → Credits / Billing →
「Purchase credits」でチャージ（最低 $5、残高は失効しない）。

コスト実測（2026-07-06）: **1投稿 ≈ $0.20**。3投稿/日 = 月93投稿 ≈ **$19/月**。
$5 チャージは約8日分。残高切れで自動投稿が黙って止まるので、
/admin/distribution で「Not posted」が続いていたらまず残高を疑うこと。

- 投稿状況の確認: https://www.gci-data.com/admin/distribution （X朝/昼/夜の列）
- 手動再送: 同ページの Actions 列「𝕏 post」ボタン（dry で文面確認してから）
- TWITTER_* の4キーは **gci-data のみ**に設定（gci-web には不要）

---

## 3. DB migration の適用

→ Claude Code に依頼すれば `.claude/skills/db-migrate` の手順で進む。
手動でやる場合:

```bash
./scripts/show-migration.sh          # 一覧
./scripts/show-migration.sh latest   # 最新の SQL をコピペ用に表示
```

出力された SQL を Supabase SQL Editor に貼り付けて実行 → 「Success」を確認。

---

## 4. シークレットのローテーション手順

漏洩疑い時・定期実施時。所要 15 分。

1. **DBパスワード**: Supabase → Settings → Database → Reset Database Password
   - 新パスワードをコピー（**この画面でしか見られない**）
   - 記号が含まれる場合は URL エンコード:
     `python3 -c "import urllib.parse,getpass; print(urllib.parse.quote(getpass.getpass(), safe=''))"`
   - `apps/web/.env.local` と `apps/data/.env.local` の `DATABASE_URL` / `DIRECT_URL` を更新
   - `./scripts/env-doctor.sh` で構造確認 → dev server 再起動 → `smoke-test.sh local`
2. **Vercel 反映**: gci-web / gci-data 両プロジェクトの Settings → Environment Variables で
   `DATABASE_URL` / `DIRECT_URL` を更新 → 両方 **Redeploy**
3. **本番確認**: `./scripts/smoke-test.sh`
4. Supabase の API キー類（`SUPABASE_*`）はコード未使用（Prisma 直結のため）。
   ローテーションしても env 更新は不要。

---

## 5. やってはいけないこと

- `.env*` の中身を画面共有・チャット・スクリーンショットに写さない
  （2026-07 に露出事故 → 全キーローテーションを実施した）
- 本番 DB への直接の DELETE / UPDATE（必ず SQL を確認してから SQL Editor で）
- `prisma migrate deploy` / `prisma db push` のローカル実行
- ポート 3000/3001 以外の kill（dev-restart.sh は 3000/3001 限定）
