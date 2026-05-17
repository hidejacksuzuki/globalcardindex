# Discord Server Setup Guide — GCI Beta

GCI の Discord サーバーを正しく構築するための手順書。  
チャンネル構成・Webhook 設定・ロール設計・招待リンク生成までを網羅する。

---

## 1. サーバー作成

1. Discord クライアントでサーバー一覧の「＋」ボタン → **サーバーを作成**
2. テンプレート: **自分と友人のため** を選択（後でカスタマイズ）
3. サーバー名: `Global Card Index` / アイコン: GCI ロゴ画像
4. 地域: Tokyo（Webhook 投稿レイテンシを最小化）

---

## 2. カテゴリ & チャンネル構成

以下の順序で作成する。チャンネル名の前に付く `#` は Discord の表示名。

### 📣 ANNOUNCEMENTS カテゴリ

| チャンネル         | 種別    | 説明                                     |
|--------------------|---------|------------------------------------------|
| `#welcome`         | テキスト | βユーザー向けウェルカムメッセージを固定   |
| `#announcements`   | テキスト | リリースノート・メンテナンス告知（投稿: Admin のみ） |
| `#beta-updates`    | テキスト | β版の変更点・新機能通知                  |

> **Tips**: `#announcements` は「サーバーの告知チャンネル」に設定するとフォロー機能が使える。

### 📊 MARKET DATA カテゴリ

| チャンネル         | 種別    | 説明                                                   |
|--------------------|---------|--------------------------------------------------------|
| `#market-alerts`   | テキスト | 大きな価格変動アラート（Webhook: `DISCORD_WEBHOOK_ALERTS`）  |
| `#rising-cards`    | テキスト | 上昇トレンドカード一覧（Webhook: `DISCORD_WEBHOOK_RISING`）  |
| `#daily-recap`     | テキスト | 日次市場まとめ（Webhook: 既存の `DISCORD_WEBHOOK` or 新規）  |

### 🔧 OPERATIONS カテゴリ（Admin のみ閲覧可）

| チャンネル         | 種別    | 説明                                                      |
|--------------------|---------|-----------------------------------------------------------|
| `#collector-log`   | テキスト | collector 実行ログ（Webhook: `DISCORD_WEBHOOK_LOG`）         |
| `#cron-log`        | テキスト | recalc / fetch cron ログ（将来拡張用）                     |
| `#errors`          | テキスト | エラー通知（将来: Sentry / Vercel alerts）                  |

### 💬 COMMUNITY カテゴリ

| チャンネル         | 種別    | 説明                              |
|--------------------|---------|-----------------------------------|
| `#general`         | テキスト | 雑談・自己紹介                    |
| `#feedback`        | テキスト | サービスへのフィードバック         |
| `#bug-report`      | テキスト | バグ・不具合報告                  |
| `#card-requests`   | テキスト | 追跡カードのリクエスト（Web UI と併用） |

---

## 3. ロール設計

### ロール一覧（優先度順）

| ロール名       | 色          | 目的                                          |
|----------------|-------------|-----------------------------------------------|
| `Admin`        | `#2B2D42`（navy） | サーバー管理者・全チャンネルアクセス        |
| `Collector`    | `#C9A84C`（gold） | データ収集担当（Operations チャンネル閲覧可） |
| `Beta Member`  | `#5865F2`（blurple） | β招待済みユーザー（Market Data 閲覧可）   |
| `@everyone`    | デフォルト  | 未確認ユーザー（`#welcome` のみ閲覧可）        |

### ロール作成手順

1. サーバー設定 → **ロール** → 「ロールを作成」
2. 上記の順番で4つ作成（優先度: Admin > Collector > Beta Member > @everyone）
3. Admin ロールに全権限を付与
4. Beta Member ロールには **メッセージを送信** + **リアクションを追加** のみ

---

## 4. チャンネル権限設定

### OPERATIONS カテゴリ（非公開化）

1. `OPERATIONS` カテゴリを右クリック → **カテゴリを編集**
2. `@everyone`: 「チャンネルを見る」→ **✕（拒否）**
3. `Admin`: 「チャンネルを見る」→ **✓（許可）**
4. `Collector`: 「チャンネルを見る」→ **✓（許可）**

### ANNOUNCEMENTS チャンネル（投稿制限）

1. `#announcements` → **チャンネルを編集** → 権限
2. `@everyone`: 「メッセージを送信」→ **✕（拒否）**
3. `Admin`: 「メッセージを送信」→ **✓（許可）**

### MARKET DATA カテゴリ（Beta Member 以上のみ）

1. `MARKET DATA` カテゴリを編集
2. `@everyone`: 「チャンネルを見る」→ **✕（拒否）**
3. `Beta Member` 以上: 「チャンネルを見る」→ **✓（許可）**

---

## 5. Webhook 設定

各チャンネルに Webhook を1つ作成し、URL を `.env` に設定する。

### 作成手順（チャンネルごと）

1. チャンネルを右クリック → **チャンネルを編集**
2. **連携サービス** → **ウェブフックを作成**
3. 名前: `GCI Bot`（共通でOK）
4. アバター: GCI ロゴ画像をアップロード
5. **ウェブフックURLをコピー** → `.env` に貼り付け

### Webhook URL マッピング

| 環境変数                   | チャンネル          | 用途                              |
|----------------------------|---------------------|-----------------------------------|
| `DISCORD_WEBHOOK_ALERTS`   | `#market-alerts`    | 10%超変動カードの自動アラート     |
| `DISCORD_WEBHOOK_RISING`   | `#rising-cards`     | 上昇トレンドカードのサマリー      |
| `DISCORD_WEBHOOK_LOG`      | `#collector-log`    | collector 実行ログ                |
| `DISCORD_WEBHOOK`          | `#daily-recap`      | 日次市場まとめ（既存）            |

### `.env` 設定例

```env
DISCORD_WEBHOOK_ALERTS="https://discord.com/api/webhooks/XXXXXXXXXX/YYYYYYYYYY"
DISCORD_WEBHOOK_RISING="https://discord.com/api/webhooks/XXXXXXXXXX/ZZZZZZZZZZ"
DISCORD_WEBHOOK_LOG="https://discord.com/api/webhooks/XXXXXXXXXX/WWWWWWWWWW"
DISCORD_WEBHOOK="https://discord.com/api/webhooks/XXXXXXXXXX/VVVVVVVVVV"
```

> ⚠️ Webhook URL は秘密情報です。Git にコミットしないこと。

---

## 6. 招待リンク生成

### Beta Member 招待リンク（推奨）

1. サーバー名をクリック → **招待を作成**
2. 対象チャンネル: `#welcome`
3. 有効期限: **7日間**（または無期限 → 手動で管理）
4. 使用回数: 招待する人数に応じて設定（初期は 25 回）
5. 生成された URL を `NEXT_PUBLIC_DISCORD_INVITE` に設定

```env
NEXT_PUBLIC_DISCORD_INVITE="https://discord.gg/XXXXXXXXX"
```

### 参加時の自動ロール付与（オプション）

MEE6 Bot など外部 Bot を使うか、手動で付与する。  
β版では Admin が手動で `Beta Member` ロールを付与する運用で十分。

1. メンバー一覧でユーザーを右クリック → **ロール** → `Beta Member` にチェック

---

## 7. #welcome チャンネルの固定メッセージ

以下をコピーして `#welcome` に投稿し、ピン留めする。

```
**Global Card Index β へようこそ！** 🎴

GCI は日本のトレカ市場（ポケカ・ワンピース）の
価格指数をリアルタイムで追跡するサービスです。

📊 **サービス**: https://globalcardindex.com
📖 **使い方ガイド**: （BETA_ONBOARDING.md の内容）

**チャンネル案内**
・#market-alerts — 大きな価格変動のアラート
・#rising-cards  — 上昇トレンドのカード
・#feedback      — サービスへのご意見
・#bug-report    — バグ・不具合報告
・#card-requests — 追跡カードのリクエスト

データや機能についての質問は #feedback へどうぞ！
```

---

## 8. 運用チェックリスト

### 初回セットアップ完了チェック

- [ ] サーバー作成・アイコン設定
- [ ] 全カテゴリ・チャンネル作成
- [ ] ロール4種作成・権限設定
- [ ] OPERATIONS カテゴリを非公開化
- [ ] 4つの Webhook 作成・URL を `.env` に設定
- [ ] Vercel に環境変数をデプロイ（設定後 `vercel env push` or ダッシュボードで設定）
- [ ] `#welcome` 固定メッセージ投稿
- [ ] 招待リンク生成・`NEXT_PUBLIC_DISCORD_INVITE` に設定
- [ ] Webhook 動作確認: `curl -X POST $DISCORD_WEBHOOK_LOG -H 'Content-Type: application/json' -d '{"content":"✅ Webhook test OK"}'`

### 日次運用

- [ ] `#collector-log` で前日の収集状況を確認
- [ ] `#market-alerts` / `#rising-cards` が正常に投稿されているか確認
- [ ] `#feedback` / `#bug-report` に未対応の報告がないか確認

---

## 9. トラブルシューティング

**Q: Webhook が投稿されない**  
A: URL が正しいか確認。Vercel の環境変数が反映されているか再デプロイを試みる。  
チャンネルに Bot の投稿権限があるか（`#market-alerts` が @everyone 非公開になっていると Bot も弾かれる場合あり → Webhook は権限を無視するので通常は問題なし）。

**Q: `#market-alerts` が毎日投稿されない**  
A: recalc ログで `DISCORD_WEBHOOK_ALERTS` の書き込みエラーがないか確認。  
変動率が `ALERT_THRESHOLD`（10%）に達していない場合は投稿されない仕様（正常動作）。

**Q: Webhook の URL が漏洩してしまった**  
A: Discord の Webhook 設定画面で即座に削除し、新しい Webhook を作成して `.env` を更新。

---

*Last updated: Week 21*
