---
name: db-migrate
description: GCI の DB スキーマ変更手順。schema.prisma を変更するとき、migration を作るとき、「DB変更」「カラム追加」「テーブル追加」を依頼されたときに必ずこの手順に従う。ローカルから prisma migrate deploy は使えない（Supabase SQL Editor 手動運用）。
---

# GCI DB Migration 手順

このプロジェクトはローカルの DIRECT_URL 制限により `prisma migrate deploy` が
使えない。migration は **Supabase SQL Editor で手動実行**する運用。

## 手順（この順番を厳守）

1. `packages/db/prisma/schema.prisma` を編集する
2. migration フォルダと SQL を**手書きで**作成する:
   - パス: `packages/db/prisma/migrations/<YYYYMMDDHHmmss>_<名前>/migration.sql`
   - SQL は冪等に書く（`IF NOT EXISTS` / `IF EXISTS` を必ず付ける）
   - 新テーブルには `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;` を忘れない
     （このプロジェクトは全テーブル RLS 有効の方針。anon 公開したいテーブルのみ
     SELECT ポリシーを追加する）
3. Prisma Client を再生成する:
   ```bash
   cd packages/db && npx prisma generate
   ```
4. 型チェック（core → web → data の順）:
   ```bash
   cd packages/core && npx tsc --noEmit
   cd apps/web && npx tsc --noEmit
   cd apps/data && npx tsc --noEmit
   ```
5. ユーザーに SQL を提示して Supabase SQL Editor での実行を依頼する:
   ```bash
   ./scripts/show-migration.sh latest
   ```
   の出力をそのまま貼るか、SQL をコードブロックで提示する。
6. ユーザーの「Success」報告を待ってから、その migration に依存する機能の
   動作確認（`./scripts/smoke-test.sh local`）に進む。

## してはいけないこと

- `prisma migrate deploy` / `prisma db push` をローカルで実行しない
  （DIRECT_URL 未設定または本番直結のため危険）
- `DROP TABLE` / `DROP COLUMN` を含む SQL はユーザーの明示的な確認なしに提示しない
- migration ファイルなしで schema.prisma だけ変更して終わらせない
  （CLAUDE.md「DB変更時は Prisma migration を作る」）

## 注意

- `apps/data` の build script には `prisma db push` が含まれるが、これは
  Vercel ビルド環境用。ローカルで `pnpm build`（data）が DIRECT_URL エラーで
  失敗するのは既知の仕様であり、`npx next build` 単体で検証する。
