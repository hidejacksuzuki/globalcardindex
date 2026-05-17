# Week 10–11: Monorepo Migration — COMPLETED ✓

## ステータス

| フェーズ | 内容 | 状態 |
|---------|------|------|
| Scaffold | root package.json / pnpm-workspace.yaml / turbo.json / tsconfig.base.json | ✅ 完了 |
| packages/db | Prisma client + schema + 全モデル型 re-export | ✅ 完了 |
| packages/core | engine / actions / utils / seo / social / auth / jobs / types | ✅ 完了 |
| packages/email | Resend client + メールテンプレート | ✅ 完了 |
| apps/web | gci-index.com — 公開フロントエンド全ルート (24 routes) | ✅ 完了 |
| apps/data | gci-data.com — 管理・cron・webhook全ルート (15 routes) | ✅ 完了 |
| Import 修正 | @/lib/prisma → @gci/db, @/actions/* → @gci/core 等 | ✅ 完了 |
| 静的ビルド検証 | 全 import/export 整合性・循環依存・型チェック | ✅ 完了 |
| バグ修正 | 循環依存 (core→email→core) 解消 / "use server" 漏れ修正 | ✅ 完了 |
| vercel.json | apps/data/vercel.json にcron移動, apps/web/vercel.json 作成 | ✅ 完了 |
| Vercel デプロイ手順 | VERCEL_DEPLOY.md 作成（環境変数・cron確認・newsletter有効化） | ✅ 完了 |
| **src/ 削除** | 本番確認後に `rm -rf src/` | ⏳ 本番確認後 |

## 最終ディレクトリ構成

```
gci-monorepo/
├── apps/
│   ├── web/                        ← gci-index.com（公開）
│   │   ├── src/app/                — 24 routes
│   │   │   ├── page.tsx            — ホーム
│   │   │   ├── cards/              — カード一覧・詳細・OG
│   │   │   ├── daily/              — デイリーリキャップ
│   │   │   ├── games/ sets/        — SEOページ
│   │   │   ├── trending/ gainers/ losers/ marketboard/ watchlist/
│   │   │   ├── newsletter/         — 購読・確認・退会
│   │   │   ├── indices/
│   │   │   ├── feed.xml/ robots.ts sitemap.ts
│   │   │   └── api/v1/cards/ index/ marketboard/ [[...route]]/
│   │   ├── src/components/
│   │   ├── src/lib/api/            — Hono routes/schemas（ローカル）
│   │   ├── src/lib/og/             — OG フォントローダー（ローカル）
│   │   ├── next.config.js          — transpilePackages: [@gci/core, @gci/db, @gci/email]
│   │   ├── vercel.json             — cron なし
│   │   └── tailwind.config.ts / tsconfig.json / postcss.config.js
│   │
│   └── data/                       ← gci-data.com（内部、noindex）
│       ├── src/app/                — 15 routes
│       │   ├── admin/              — prices / sources / index / logs / distribution / newsletter
│       │   └── api/v1/cron/*       — 6 cron endpoints
│       │               webhooks/   — resend bounce
│       ├── src/lib/collectors/     — eBay / Mercari / Snkrdunk / CSV
│       ├── src/middleware.ts       — Basic Auth guard for /admin/*
│       ├── next.config.js          — transpilePackages: [@gci/core, @gci/db, @gci/email]
│       └── vercel.json             — 6 cron スケジュール
│
├── packages/
│   ├── db/                         ← @gci/db
│   │   ├── prisma/schema.prisma
│   │   └── src/index.ts            — PrismaClient singleton + 全モデル型 re-export
│   │
│   ├── core/                       ← @gci/core
│   │   └── src/
│   │       ├── index.ts            — 全サブパッケージの barrel re-export
│   │       ├── actions/            — admin / cards / indexValue / market / newsletter
│   │       │                         recap / seo / watchlist ("use server")
│   │       ├── engine/             — indexCalculator / trustScore / staleDetector 等
│   │       ├── utils/              — formatDate / formatPrice / normalizeTitle
│   │       ├── seo/                — games / slugify
│   │       ├── social/             — twitter / discord
│   │       ├── auth/               — cronAuth
│   │       ├── jobs/               — recalcIndex / updatePrices / detectAnomalies
│   │       └── types/              — card / market / api
│   │
│   └── email/                      ← @gci/email
│       └── src/index.ts            — sendEmail + buildConfirmEmail +
│                                     buildUnsubscribeEmail + buildDailyNewsletterEmail
│
├── src/                            ← 旧コード（移行元、削除可能）
├── package.json                    — npm workspaces root
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## インポートマッピング（移行済み）

| 旧パス | 新パス |
|--------|--------|
| `@/lib/prisma` | `@gci/db` |
| `@/lib/db` | `@gci/db` |
| `@/lib/engine/*` | `@gci/core` |
| `@/lib/utils/*` | `@gci/core` |
| `@/lib/seo/*` | `@gci/core` |
| `@/lib/auth/*` | `@gci/core` |
| `@/lib/social/*` | `@gci/core` |
| `@/lib/email/resend` | `@gci/email` |
| `@/actions` / `@/actions/*` | `@gci/core` |
| `@/jobs/*` | `@gci/core` |
| `@/types` / `@/types/*` | `@gci/core` |

## ローカル開発

```bash
# 依存関係インストール（pnpm 推奨）
pnpm install

# DB クライアント生成
pnpm db:generate

# 全アプリ起動
pnpm dev

# apps/web のみ（port 3000）
pnpm dev:web

# apps/data のみ（port 3001）
pnpm dev:data
```

## Vercel デプロイ設定

Vercel で **2つの別プロジェクト** を作成し、それぞれ `Root Directory` を設定する。

| プロジェクト名 | Domain | Root Directory | Framework |
|-------------|--------|---------------|-----------|
| gci-web | gci-index.com | `apps/web` | Next.js |
| gci-data | gci-data.com | `apps/data` | Next.js |

### gci-web 環境変数
```
DATABASE_URL
NEXT_PUBLIC_BASE_URL=https://gci-index.com
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_WEBHOOK_SECRET
NEWSLETTER_SEND_ENABLED
```

### gci-data 環境変数
```
DATABASE_URL
NEXT_PUBLIC_BASE_URL=https://gci-index.com   # メールの公開URLに使用
CRON_SECRET
ADMIN_USER
ADMIN_PASSWORD
TWITTER_API_KEY
TWITTER_API_SECRET
TWITTER_ACCESS_TOKEN
TWITTER_ACCESS_SECRET
DISCORD_WEBHOOK_URL
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_WEBHOOK_SECRET
NEWSLETTER_SEND_ENABLED
```

## 旧 src/ の削除タイミング

`src/` は現時点でも動作する（壊していない）。  
新アプリが本番デプロイ・動作確認完了後に削除する。

```bash
# 削除コマンド（本番確認後に実行）
rm -rf src/
```
