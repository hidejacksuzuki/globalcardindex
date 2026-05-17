# GCI Daily Ops — β 運用 SOP

> **所要時間**: 30〜60分/日  
> **β 期間で一番大事なこと**:  
> 機能追加ではなく、**「何を見に戻ってきているか」** を把握すること。

---

## Daily Ops 全体フロー

```
① Health 確認 (5分)
        ↓
② Collector 運用 (15〜30分)
        ↓
③ Feedback 確認 (10分)
        ↓
④ Analytics 確認 (5〜10分)
        ↓
⑤ Small Improvements (残り時間)
```

---

## ① Cron / Health 確認（5分）

**最初に「壊れていないか」を確認する。壊れたまま運用しない。**

### 見る場所

| 場所 | URL | 確認ポイント |
|---|---|---|
| Admin ログ | `/admin/logs` | recalc stale / collector failure / backup failure |
| Discord | `#collector-log` | 昨夜の recalc サマリー |
| GitHub Actions | Actions タブ | backup.yml の成否 |
| Health API | `/api/v1/health` | `"ok":true` かどうか |

### 赤信号のパターン

```
⚠ recalc stale     → 自動 cron が止まっている。Vercel cron を確認
⚠ 0 imported       → collector が動いていない。手動で実行
⚠ backup failure   → GitHub Actions → backup.yml のログを確認
⚠ health: error    → DB 接続エラーの可能性。Vercel 環境変数を確認
```

---

## ② Collector 運用（15〜30分）

**毎日ここがデータの芯。最初は量より品質。**

### フロー

```
/admin/collector (検索URLリスト確認)
        ↓
Mercari URL を開く（SOLD フィルター優先）
        ↓
テキストコピー or JSON 収集
        ↓
/admin/collector/import に貼り付け
        ↓
/admin/collector/review でレビュー
        ↓
Approve（Median Warning は要確認）
        ↓
/admin/index → Recalc 実行
```

### 収集優先順位（β期間）

1. **ユーザーがウォッチしているカード**（最優先）
   ```sql
   -- Prisma Studio か /admin で確認
   SELECT c.name, COUNT(*) as watchers
   FROM UserWatchlistItem uwi JOIN Card c ON c.id = uwi.cardId
   GROUP BY c.id ORDER BY watchers DESC LIMIT 20;
   ```
2. **Card Request が多いカード** → `/admin/card-requests` の Grouped タブ
3. **LOW 信頼度カード** → `/admin/index` でフィルター
4. **繰り返し閲覧されているカード** → Plausible の Popular Pages

### 承認基準

| 状況 | 判断 |
|---|---|
| 正常な取引、状態明記あり | ✅ Approve |
| Median Warning、でも範囲内 | ✅ Approve |
| 中央値の 2倍以上 or 半分以下 | ⚠ 要確認、怪しければ Reject |
| まとめ売り / セット売り | ❌ Reject |
| タイトルにカード名なし | ❌ Reject |

### Recalc 後の確認

```bash
# Discord #collector-log に来たサマリーを確認
# ±10% 以上動いたカードは #market-alerts に自動通知済み
# /admin/index で HIGH 信頼度カードが増えているか確認
```

---

## ③ Feedback 確認（10分）

**「何が欲しいか」が最もダイレクトに分かる。毎日必ず見る。**

### 見るもの

| ソース | 場所 | 見るポイント |
|---|---|---|
| Card Requests | `/admin/card-requests` (Grouped タブ) | count ≥ 3 のカード → 今すぐ追加候補 |
| Discord | `#feedback` | バグ報告、UX不満、「◯◯がない」 |
| DM | X / メール | 個別の熱量あるフィードバック |
| 検索0件 | Plausible → `/cards?q=xxx` | ユーザーが探して見つからなかったカード |
| Most Requested | `/most-requested` | 市場需要ランキングとして読む |

### `/most-requested` の読み方

> これは単なる要望一覧じゃない。**市場需要ランキング**だ。  
> 「多くの人が探しているが、まだデータがない」カードは  
> 追加すると即座に閲覧数が上がる可能性が高い。

```
count ≥ 5 → 今週中に追加を検討
count 3〜4 → 来週の収集リストに追加
count 1〜2 → 様子見
```

### フィードバック分類とアクション

```
バグ報告       → data/FEEDBACK_LOG.md に記録 → 24h 以内対応
UX 不満        → 記録 → ⑤ Small Improvements の候補
カード不足      → /admin/card-requests で確認 → collector 追加
機能要望        → 記録 → Week 26+ で検討
```

---

## ④ Analytics 確認（5〜10分）

**Plausible で「繰り返し見られているか」を確認する。**

### 見るもの

| 指標 | 場所 | 意味 |
|---|---|---|
| 人気カード | Pages → `/cards/[slug]` | 何が繰り返し見られているか |
| 離脱ページ | Exit Pages | どこで離脱しているか |
| `/most-requested` | Pages | 需要シグナルの確認 |
| `/account` → `/login` | Funnels | ログイン転換率 |

### 最重要シグナルの読み方

**強いシグナル（ユーザーが本当に使っている）**
- 同じカードを複数回・複数日にわたって閲覧
- Watchlist 追加（`/api/v1/watchlist` へのリクエスト増加）
- Card Request 送信
- Discord 参加
- weekly recap メール開封

**弱いシグナル（まだ引っかかっていない）**
- 1回だけのアクセスで離脱
- Index を見て、そのまま戻らない
- `confidence: LOW` ページのみ閲覧

### 判断フレームワーク

```
「このカード、昨日も今日も見られている」
              ↓
→ データ品質を上げる（collector 優先）
→ 関連カードのリンクを増やす

「このページで離脱が多い」
              ↓
→ empty state / CTA / 説明文を改善
→ ⑤ Small Improvements の候補

「/login の離脱が多い」
              ↓
→ フォームの文言・UX を見直す
```

---

## ⑤ Small Improvements（残り時間）

**β期間は大改修より小さい改善を積み上げる。**

### 効果が出やすいもの（優先度順）

| 改善 | 理由 |
|---|---|
| empty state の改善 | 「何もない」より「次のアクション」を示す |
| CTA の追加・改善 | Watch ボタン、Discord 誘導、card request |
| confidence の説明 | LOW/HIGH の意味をユーザーが分かっていない |
| copy の改善 | 1 行変えるだけで理解度が変わる |
| Discord 導線強化 | コミュニティに入ってもらうと定着率が上がる |
| request flow の改善 | フォームが分かりにくいと使われない |

### やり方

1. ③④ で見つけた「つまずいている場所」を 1 つ選ぶ
2. 1 ファイル、5〜20 行以内の変更に絞る
3. `git commit -m "improve: [場所] [何を変えたか]"` でコミット
4. 翌日 Analytics で効果を確認

---

## 週次タスク（金曜 or 月曜）

```
✓ data/watchlist.csv の見直し（収集不要カード削除、新カード追加）
✓ /admin/index で LOW 信頼度カード確認 → 来週の重点収集リストに
✓ /admin/cards で重複カード確認
✓ FEEDBACK_LOG.md に週の振り返りを記録
✓ watchlist-alerts dry-run でターゲットユーザー数を確認
✓ weekly-recap dry-run で内容をプレビュー
```

---

## 自動 Cron スケジュール（参考）

| Job | 時刻 (JST) | 内容 |
|---|---|---|
| `cron/fetch` | 毎 10 分 | 価格データ取得 |
| `cron/recalc` | 毎時 0 分 | Index 再計算 |
| `cron/daily-snapshot` | 09:00 | 日次サマリー保存 |
| `cron/daily-discord` | 11:00 | Discord 日次レポート |
| `cron/daily-post` | 10:00 | X 投稿 |
| `cron/daily-newsletter` | 10:00 | Newsletter 送信 |
| `cron/backup` | 12:00 | DB バックアップ確認 |
| `cron/health` | 毎 30 分 | 全 cron 監視 |
| `cron/watchlist-alerts` | 03:30 | 価格スパイクアラート |
| `cron/weekly-recap` | 月 09:00 | 週次まとめメール |

---

## β 期間の判断軸

> **「何を作るか」より「ユーザーが何を繰り返し見るか」を軸に動く。**

```
繰り返し見られている     → そこのデータ・UX を磨く
1回見て離脱している      → empty state / 説明 / CTA を改善
要望が多いカードがある    → collector で追加、Most Requested に乗せる
機能要望が届いた         → 記録はするが、即実装しない。β後に判断
```

---

## トラブルシューティング

**Q. 収集したのに指数が変わらない**  
A. `MIN_SAMPLES_COMPUTE=3` 未満。同カードを 3 件以上集めてください。

**Q. LOW 信頼度が多い**  
A. 蓄積不足。毎日同じカードを収集し続けると HIGH になります。

**Q. Recalc がエラー**  
A. `/admin/logs` → エラーログ確認。DB 接続エラーなら Vercel 環境変数を確認。

**Q. Discord に通知が来ない**  
A. `DISCORD_WEBHOOK_ALERTS` / `DISCORD_WEBHOOK_LOG` の設定を確認。

**Q. ウォッチリストアラートが誰にも届かない**  
A. `watchlist-alerts?dry=1` で `targetUsers: 0` なら、ユーザーがウォッチしていないか変動がしきい値未満。`ALERT_SEND_ENABLED=true` も確認。
