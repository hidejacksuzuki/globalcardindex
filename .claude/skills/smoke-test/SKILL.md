---
name: smoke-test
description: GCI の動作確認（ローカル/本番スモークテスト）。機能実装後・デプロイ後・「動作確認して」「smoke test して」と言われたときに使う。手動で curl を打たずに必ずこのスクリプトを使うこと。
---

# GCI Smoke Test

## 実行方法

```bash
# ローカル (dev server が localhost:3000/3001 で起動している前提)
./scripts/smoke-test.sh local

# 本番 (gci-index.com / www.gci-data.com)
./scripts/smoke-test.sh

# cron の dry-run も含める場合（ユーザーに CRON_SECRET の設定を依頼）
CRON_SECRET=xxx ./scripts/smoke-test.sh
```

## 前提条件

- ローカルモードは dev server が起動済みであること。起動していなければ、
  先に `./scripts/dev-restart.sh` を実行してポート解放＋env診断を行い、
  ユーザーに `pnpm dev:web` / `pnpm dev:data` の起動を依頼する
  （dev server の起動はユーザーのターミナルで行う運用）。
- 初回アクセスは Next.js のコンパイルで遅い（20秒超）。FAIL が出たら
  1回だけ再実行してから判断する。

## 結果の解釈

- exit 0 = 全チェック合格。FAIL の行があれば該当 URL を個別に調査する。
- ローカルで `Can't reach database server` → `./scripts/env-doctor.sh` を実行して
  env の構造を診断する（値は表示されないので安全）。
- 本番 admin が 401 → 正常（Basic Auth 保護は意図した設計）。

## してはいけないこと

- `.env.local` の中身を cat したり値を表示したりしない（env-doctor が構造のみ検査する）。
- FAIL の修正で本番 DB のデータを直接変更しない（必ずユーザーに確認）。
