# GCI Public Beta Checklist

> **Status:** Public Beta — Week 23 (User Accounts & Persistent Watchlist)  
> **Last updated:** 2026-05-12  
> **Target:** globalcardindex.com limited public release

---

## 1. Feature Status

| Feature | Status | Notes |
|---|---|---|
| Global GCI Index | ✅ Live | 30-day rolling window, IQR-trimmed |
| Per-card index values | ✅ Live | Written via `recalcIndex` cron job |
| Confidence tiers (HIGH / MED / LOW) | ✅ Live | Based on sample count + outlier rate |
| Condition-based weighting (NM/LP/MP/HP/DMG) | ✅ Live | Applied in `aggregatePrices` |
| TrustScore v2 (sold bonus + URL bonus) | ✅ Live | +10 for sold listings, +5 for URL |
| `/marketboard` — reliable vs reference split | ✅ Live | Section tabs via URL param |
| `/cards` — index + confidence columns + filter pills | ✅ Live | Condition & confidence URL filters |
| `/cards/[slug]` — per-card index panel | ✅ Live | Suppressed when sampleCount < 3 |
| `/games/[slug]` — game index page | ✅ Live | |
| `/daily` — daily recap | ✅ Live | Latest + archive via `/daily/[date]` |
| `/daily/[date]` — date archive | ✅ Live | |
| `/trending` — trending cards | ✅ Live | |
| `/gainers` / `/losers` | ✅ Live | |
| `/indices` — GCI global history | ✅ Live | |
| `/sets/[name]` — set detail pages | ✅ Live | |
| `/newsletter` — email signup | ✅ Live | |
| `/terms` — 利用規約・免責事項 | ✅ Live | |
| `/watchlist` — anonymous saved card list | ✅ Live | Cookie-based; auto-migrates on login |
| Disclaimer component (inline / banner / footer) | ✅ Live | Shown on all data pages |
| OG images | ✅ Live | home, `/daily`, `/daily/[date]`, `/cards/[slug]`, `/games/[slug]` |
| RSS feed (`/feed.xml`) | ✅ Live | Auto-discovered via `<link rel="alternate">` |
| Sitemap (`/sitemap.xml`) | ✅ Live | Public routes only; no admin/API routes |
| robots.txt — `/admin/*` and `/api/*` disallowed | ✅ Live | Verified |
| Admin app (`data.globalcardindex.com`) | ✅ Live | Separate Vercel deployment |
| Cron recalc (`/api/v1/cron/recalc`) | ✅ Live | Runs nightly; logs stored in `RecalcLog` |
| `/admin/index` — per-card quality dashboard | ✅ Live | Client-side, bearer-auth protected |
| `/admin/prices` — price data browser | ✅ Live | |
| Manual recalc from admin UI | ✅ Live | Per-card or full recalc |
| Card request form (public) | ✅ Live | `CardRequestButton` on `/cards` + card detail pages |
| `/most-requested` — market demand signal | ✅ Live | 5-min revalidate; game filter pills |
| `/admin/card-requests` — grouped + convert | ✅ Live | Duplicate detection, "Card化" action |
| Watchlist alert emails (price spike ≥15%) | ✅ Live | Per-user personalized; respects `marketAlerts` pref |
| Weekly recap (newsletter + Discord, Monday) | ✅ Live | `WEEKLY_SEND_ENABLED` flag + dry-run mode |
| Retention CTAs (footer Discord banner, card CTAs) | ✅ Live | Conditional on `NEXT_PUBLIC_DISCORD_INVITE` |
| **User accounts — email magic-link** | ✅ **Week 23** | Auth.js v5 + Resend; no passwords |
| **`/login` — email sign-in page** | ✅ **Week 23** | CSRF-safe form; redirects after sign-in |
| **`/login/verify` — check your email page** | ✅ **Week 23** | Static; lists 10-min expiry tip |
| **`/account` — profile + DB watchlist + notification prefs** | ✅ **Week 23** | Protected by middleware |
| **WatchButton dual-mode (DB + cookie fallback)** | ✅ **Week 23** | `userId` prop switches persistence layer |
| **Anonymous→user watchlist migration** | ✅ **Week 23** | `MigrateBanner` + `POST /api/v1/watchlist/migrate` |
| **`PATCH /api/v1/account/prefs` — notification preferences** | ✅ **Week 23** | Auth-gated; `marketAlerts` / `weeklyRecap` / `newsletter` |
| **Per-user watchlist alerts cron** | ✅ **Week 23** | Only alerts on *watched* cards; respects `marketAlerts` pref |

---

## 2. Confidence Thresholds

Confidence tiers control display and placement across the UI.

| Tier | Criteria | UI Treatment |
|---|---|---|
| **HIGH** | ≥ 10 clean samples AND outlier rate < 20% | Green badge; shown in "信頼できる指数" tab on Marketboard |
| **MED** | ≥ 3 clean samples AND outlier rate < 40% | Amber badge; shown in "信頼できる指数" tab on Marketboard |
| **LOW** | Below MED threshold | Red badge; shown in "参考値 / データ不足" tab; labeled 参考値 on card page |
| **None** | `sampleCount < MIN_SAMPLES_DISPLAY` (3) | Index suppressed entirely on public card page |

Constants (defined in `packages/core/src/engine/indexCalculator.ts`):
- `MIN_SAMPLES_COMPUTE = 3` — minimum to run calculation at all
- `MIN_SAMPLES_DISPLAY = 3` — minimum to show index on public pages
- `IQR_FENCE = 1.5` — Tukey fence multiplier for outlier detection
- `TRIM_RATIO = 0.05` — 5% trim applied after IQR removal

---

## 3. Data Sources

| Source | Type | Trust weight | Notes |
|---|---|---|---|
| メルカリ (Mercari Japan) | Secondary market | Configurable per source | Primary data source; sold + active listings |
| Other sources | TBD | TBD | Additional sources planned post-beta |

**TrustScore v2 bonuses:**
- `availability === "sold"` → +10 (confirmed transaction is more reliable)
- `hasUrl === true` → +5 (listing with URL traceable)

**Condition weight map:**
- NM 1.0 · LP 0.95 · MP 0.85 · HP 0.70 · DMG 0.55

---

## 4. Known Limitations

1. **Single data source**: Beta uses Mercari as the sole market. Price signals may not reflect other markets (TCGPlayer, CardMarket, eBay, etc.).
2. **LOW confidence cards are common**: Many cards have fewer than 10 recent sales, making HIGH confidence rare during early beta.
3. **Index update frequency**: Cron runs nightly. Prices observed during the day are not reflected until the next recalc.
4. **No PSA/graded card support**: Only raw card conditions (NM/LP/MP/HP/DMG). Graded card prices are not separated.
5. **Condition mixing**: When a card has listings across multiple conditions, each condition gets its own index row. Cards searched without a condition filter may see multiple rows.
6. **Watchlist requires login for persistence**: The anonymous cookie watchlist persists only in that browser. Sign in to get cross-device sync and price alert emails.
7. **Set name URL encoding**: Set names use `encodeURIComponent` in sitemap and routing. Names with special characters may have edge cases.
8. **No historical data before launch**: Index history only begins from first recalc run. No backfill of pre-launch data.
9. **Beta stability**: Algorithm parameters (IQR fence, confidence thresholds, condition weights) may be adjusted during beta without notice.
10. **Admin app not rate-limited**: `/apps/data` endpoints rely on bearer token + referer; no per-IP rate limiting in place.
11. **Watchlist alert emails require DB watchlist**: Anonymous (cookie) watchlist users do not receive price spike emails. Users must sign in and have cards in their account watchlist to receive alerts.
12. **No account deletion flow**: Users can sign out but there is no self-service account or data deletion UI in this release.

---

## 5. Manual Steps Before Public Launch

### Infrastructure
- [ ] Verify `NEXT_PUBLIC_BASE_URL` is set to `https://globalcardindex.com` in Vercel (web app)
- [ ] Verify `NEXT_PUBLIC_BASE_URL` is set to `https://data.globalcardindex.com` in Vercel (data app)
- [ ] Confirm `DATABASE_URL` points to production Postgres in both Vercel projects
- [ ] Run `pnpm prisma migrate deploy` against production DB to apply all pending migrations (includes User, Account, Session, VerificationToken, UserWatchlistItem, NotificationPrefs tables — Week 23)
- [ ] Seed initial `IndexValue` rows by triggering `POST /api/v1/index/recalc` once from admin

### Auth.js Setup (Week 23 — new)
- [ ] Generate `AUTH_SECRET`: `openssl rand -base64 32` — set in Vercel env vars (web app)
- [ ] Set `AUTH_RESEND_KEY` in Vercel env vars (web app) — Resend API key for magic-link emails
- [ ] Verify `RESEND_FROM_EMAIL` is set and the domain is verified in Resend dashboard
- [ ] Smoke-test magic-link flow end-to-end: `/login` → submit email → receive email → click link → land on `/account`
- [ ] Verify the `gci_session` cookie migration banner appears when logging in after using the anonymous watchlist
- [ ] Confirm `NotificationPrefs` row is auto-created on first sign-in (check DB or `/account`)

### Notification Preferences (Week 23 — new)
- [ ] Toggle each preference on `/account` and verify `PATCH /api/v1/account/prefs` returns `{ ok: true }`
- [ ] Confirm `watchlist-alerts` dry-run only targets users with matching `UserWatchlistItem` rows: `GET /api/v1/cron/watchlist-alerts?dry=1`
- [ ] Send a test alert email: `GET /api/v1/cron/watchlist-alerts?test=your@email.com`

### SEO / Crawlability
- [ ] Submit sitemap to Google Search Console: `https://globalcardindex.com/sitemap.xml`
- [ ] Verify `robots.txt` is live: `https://globalcardindex.com/robots.txt`
- [ ] Check OG image rendering via Twitter Card Validator and Facebook Debugger for at least: `/`, `/daily`, one card page
- [ ] Confirm canonical URLs match `NEXT_PUBLIC_BASE_URL` (no `www.` vs non-`www.` split)
- [ ] Confirm `/login`, `/account`, `/login/verify` are `noindex` (set via `metadata.robots`)

### Cron Jobs
- [ ] Confirm Vercel Cron is calling `GET /api/v1/cron/recalc` nightly with correct `CRON_SECRET` header
- [ ] Confirm `RecalcLog` is being written after first cron run (check `/admin/index`)
- [ ] Confirm `IndexValue` rows are appearing per-card after first recalc
- [ ] Confirm `watchlist-alerts` cron runs at 03:30 JST (18:30 UTC) — verify `apps/data/vercel.json`
- [ ] Confirm `weekly-recap` cron runs at 09:00 JST Monday (00:00 UTC Monday) — verify `apps/data/vercel.json`
- [ ] Set `ALERT_SEND_ENABLED="true"` in Vercel (data app) after smoke-testing
- [ ] Set `WEEKLY_SEND_ENABLED="true"` in Vercel (data app) after smoke-testing

### Content
- [ ] Review `/terms` page — confirm dates and descriptions are accurate
- [ ] Confirm Disclaimer component is visible on `/marketboard`, `/cards`, `/cards/[slug]`, home page
- [ ] Check `/newsletter` page is live with working signup form (or placeholder)
- [ ] Confirm `/most-requested` page shows at least 5 entries (requires card request data)

### Final Smoke Test
- [ ] Home page loads with GCI index value and sparkline
- [ ] `/marketboard` — both "信頼できる指数" and "参考値" tabs show data
- [ ] `/cards` — filter pills (condition + confidence) work
- [ ] `/cards/[slug]` for a HIGH-confidence card — index panel visible + WatchButton functional
- [ ] `/cards/[slug]` for a LOW-confidence card — 参考値 label shown
- [ ] `/daily` — today's recap or "coming soon" state renders cleanly
- [ ] `/games` — all games listed with links to `/games/[slug]`
- [ ] RSS feed returns valid XML: `https://globalcardindex.com/feed.xml`
- [ ] Sitemap returns valid XML: `https://globalcardindex.com/sitemap.xml`
- [ ] No 500 errors in Vercel logs for any public route
- [ ] **[Week 23]** `/login` renders, submits form, redirects to `/login/verify`
- [ ] **[Week 23]** `/account` is protected — unauthenticated redirect to `/login?callbackUrl=/account`
- [ ] **[Week 23]** After sign-in, WatchButton on `/cards/[slug]` persists to DB watchlist
- [ ] **[Week 23]** Anonymous watchlist migration banner visible on `/account` if `gci_session` cookie exists
- [ ] **[Week 23]** "カードを引き継ぐ" button migrates cookie watchlist and refreshes page

---

## 6. Auth.js Environment Variables Reference (Week 23)

| Variable | Required | Description |
|---|---|---|
| `AUTH_SECRET` | ✅ Yes | Random 32+ char secret. `openssl rand -base64 32` |
| `AUTH_RESEND_KEY` | ✅ Yes | Resend API key for magic-link emails. Falls back to `RESEND_API_KEY` |
| `RESEND_FROM_EMAIL` | ✅ Yes | Sender address, e.g. `GCI <noreply@globalcardindex.com>` |
| `AUTH_URL` | ⚠️ Local only | Not needed on Vercel (auto-detected). Set to `http://localhost:3000` for local dev |

---

## 7. Week 24 クローズドβ 直前チェックリスト（5〜10人招待版）

> このセクションはβ招待を送る直前に 1 項目ずつ確認する最終ゲートです。

### 本番環境セットアップ確認
- [ ] `AUTH_SECRET` — Vercel (web app) に設定済み
- [ ] `AUTH_RESEND_KEY` — Vercel (web app) に設定済み
- [ ] `RESEND_FROM_EMAIL` — Resend ダッシュボードでドメイン検証済み
- [ ] `prisma migrate deploy` — 本番 DB に Week 23 マイグレーション適用済み
- [ ] `ALERT_SEND_ENABLED="true"` — Vercel (data app) に設定済み
- [ ] `WEEKLY_SEND_ENABLED="true"` — Vercel (data app) に設定済み

### スモークテスト実行
- [ ] `./scripts/smoke-test.sh` を本番 URL に対して実行 → 全 PASS 確認
- [ ] `CRON_SECRET=xxx ./scripts/smoke-test.sh` でcronドライランも PASS 確認

### 認証フロー手動確認
- [ ] 自分のメールで `/login` → メール受信 → リンクをクリック → `/account` に着地
- [ ] magic-link メールの件名・本文・ボタンが正しく表示される
- [ ] `/account` に自分の Email が表示されている
- [ ] WatchButton で 1 枚ウォッチ → DB に `UserWatchlistItem` が作成されている（Prisma Studio か Admin で確認）
- [ ] ウォッチ後に `/account` を開くとそのカードがリストに表示される
- [ ] 通知設定のトグルを操作 → `PATCH /api/v1/account/prefs` が `200 ok:true` を返す
- [ ] サインアウト → `/account` にアクセスすると `/login?callbackUrl=/account` にリダイレクト
- [ ] 再サインイン後に callbackUrl `/account` へ戻る

### noindex / クロール保護確認
- [ ] `curl -I https://globalcardindex.com/login` → `x-robots-tag: noindex` ヘッダーあり
- [ ] `curl -I https://globalcardindex.com/account` → 302リダイレクト（未ログイン時）
- [ ] `curl -s https://globalcardindex.com/robots.txt` → `/api/` が Disallow に含まれる

### β招待送付
- [ ] `data/BETA_INVITE.md` の招待メールをカスタマイズ（URL・Discord リンク確認）
- [ ] 送付ログ（BETA_INVITE.md §6）に記録しながら招待メールを順次送付
- [ ] Discord `#welcome` に固定メッセージを設定（BETA_INVITE.md §3 を使用）
- [ ] 招待後 24 時間以内に登録者がゼロの場合はメール再送またはフォローアップ

### βユーザー受け入れ後の監視
- [ ] Vercel Logs → Error タブ を毎日確認（β期間中）
- [ ] `/admin/newsletter` — 新規登録者数を毎日確認
- [ ] Plausible Analytics — `/login`、`/account` のページビューを確認
- [ ] Discord `#feedback` チャンネルを毎日確認、バグ報告に 24h 以内に返答

---

## 8. Post-Beta Roadmap (not blocking launch)

- Multi-source data ingestion (TCGPlayer, eBay)
- PSA / graded card index separation
- Game-specific index sub-indices
- API v2 for developer access
- Account deletion / data export (GDPR)
- Email unsubscribe page (linked from alert emails; currently links to `/account`)
- Push notifications (browser / PWA)
