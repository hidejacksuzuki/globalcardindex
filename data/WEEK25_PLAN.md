# Week 25: Closed Beta Launch & Feedback

> **目標**: 5〜10人のクローズドβユーザーに使ってもらい、  
> ログイン・ウォッチリスト・アラートが"壊れないか"を確認する。  
> 機能追加よりフィードバック収集とバグ対応を優先する週。

---

## 週の構造

```
月  招待メール送付 (5〜10人)
火  ログ確認 + Discord 反応確認
水  バグ対応 / データ補充
木  collector 運用 (通常運用)
金  フィードバック集計 + 次週調整
```

---

## 毎日のルーティン（所要時間 約 20 分/日）

### 朝（09:00）

1. **Vercel ログ確認**
   ```
   apps/web  → Deployments → 直近デプロイ → Function Logs → Error
   apps/data → 同上
   ```
   - 500 エラーがあれば即対応
   - `AUTH_*` 関連エラーは認証設定ミスの可能性

2. **Discord #feedback 確認**
   - バグ報告 → GitHub Issues か FEEDBACK_LOG.md に記録
   - 「このカードがない」系 → `/admin/card-requests` で確認

3. **Plausible Analytics 確認**（1 分）
   - `/login` ページビュー → 登録試行数の目安
   - `/account` ページビュー → ログイン完了数
   - 直帰率が高ければメール文面 or ログインフローの問題

### 週 1 回（月曜）

4. **weekly-recap メール動作確認**
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://data.globalcardindex.com/api/v1/cron/weekly-recap?dry=1"
   ```

5. **watchlist-alerts 動作確認**
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://data.globalcardindex.com/api/v1/cron/watchlist-alerts?dry=1"
   ```
   → `targetUsers` が 0 のままなら「誰もウォッチしていない」か「カードに変動がない」

---

## フィードバック収集フロー

```
Discord #feedback に投稿
        ↓
カテゴリ分類
  ├── バグ        → 即対応（24h 以内）
  ├── UX 不満    → FEEDBACK_LOG.md に記録、優先度付け
  ├── カード不足  → /admin/card-requests で確認 → collector 追加
  └── 機能要望   → FEEDBACK_LOG.md に記録、Week 26+ で検討
```

### FEEDBACK_LOG.md テンプレート（各週作成）

| # | 日付 | ユーザー | 種類 | 内容 | 対応状況 |
|---|---|---|---|---|---|
| 1 | | | バグ/UX/データ/要望 | | 未対応/対応中/完了 |

---

## collector 運用（通常通り）

```
毎日: メルカリ検索 → 結果を /admin/collector/import にペースト
      → /admin/collector/review で承認
      → 夜の recalc cron で自動更新
```

β期間中にユーザーがウォッチしているカードを優先的にデータ収集する。

### ウォッチリスト確認クエリ（Prisma Studio または Admin）
```sql
-- 最もウォッチされているカード TOP 20
SELECT c.name, c."setName", COUNT(*) as watchers
FROM "UserWatchlistItem" uwi
JOIN "Card" c ON c.id = uwi."cardId"
GROUP BY c.id, c.name, c."setName"
ORDER BY watchers DESC
LIMIT 20;
```

---

## バグ対応プロセス

### 優先度 HIGH（即日対応）
- ログインできない
- `/account` が 500 エラー
- アラートメールが届かない（自分のウォッチで確認）
- cookie 移行バナーが出ない / 移行に失敗する

### 優先度 MED（48h 以内）
- WatchButton が反応しない
- 通知設定トグルが保存されない
- `/most-requested` / `/login/verify` 表示崩れ

### 優先度 LOW（週次対応）
- 文言の改善提案
- デザイン微調整
- カード不足（データ運用で対応）

---

## Week 25 の「してはいけないこと」

- ❌ 大きな機能追加（認証フロー変更、スキーマ変更など）
- ❌ Cron スケジュールの変更
- ❌ `SEND_ENABLED` フラグを無確認で変更
- ❌ β ユーザーのデータを削除・リセット

---

## Week 26 以降への引き継ぎ観点

β終了後に「何が明らかになったか」を以下の軸で整理する:

| 観点 | 確認事項 |
|---|---|
| **ログイン定着率** | 招待した N 人中何人が 3 日以内に登録したか |
| **ウォッチリスト利用率** | 登録ユーザーのうち何人が 1 枚以上ウォッチしたか |
| **アラート受信** | 実際にアラートメールが届いたユーザーの反応 |
| **データ品質** | 「価格がおかしい」「カードがない」の頻度 |
| **機能要望 TOP 3** | Discord フィードバックから集計 |

この結果を元に **Week 26 ロードマップ** を決定する。

---

## 次フェーズ候補（Week 26 以降）

優先度は β フィードバック次第。

| 候補 | 理由 |
|---|---|
| カード詳細ページ改善（価格履歴グラフ強化） | ユーザーが最も時間を使うページ |
| ウォッチリスト一括操作（並び替え・削除） | β で必ず要望が出る |
| `/account` にログイン履歴・デバイス管理 | セキュリティ意識の高いユーザー向け |
| カード画像対応（Scryfall / TCGPlayer API） | 視覚的な説得力が上がる |
| multi-source 価格比較（TCGPlayer / eBay） | 信頼性向上 |
| PSA グレード分離 | 上位ユーザー向け |
