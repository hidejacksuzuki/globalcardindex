# Vercel Deployment Checklist

Two Vercel projects, one shared Supabase database.

---

## Step 0 — Local verification (run first)

```bash
# 1. Install dependencies (pnpm required)
pnpm install

# 2. Generate Prisma client
pnpm db:generate

# 3. Verify apps/web boots
pnpm dev:web          # http://localhost:3000

# 4. Verify apps/data boots
pnpm dev:data         # http://localhost:3001

# 5. Production build (both apps)
pnpm build
```

---

## Step 1 — Create Vercel projects

Create **two separate Vercel projects** from the same GitHub repository.

| Setting | gci-web | gci-data |
|---------|---------|---------|
| Project name | `gci-web` | `gci-data` |
| Repository | `<your-repo>` | `<your-repo>` (same) |
| **Root Directory** | `apps/web` | `apps/data` |
| Framework Preset | Next.js | Next.js |
| Build Command | `cd ../.. && pnpm build --filter=web` | `cd ../.. && pnpm build --filter=data` |
| Output Directory | `.next` | `.next` |
| Install Command | `cd ../.. && pnpm install --frozen-lockfile` | `cd ../.. && pnpm install --frozen-lockfile` |

> **Note**: Vercel's monorepo support detects `apps/web` and `apps/data` automatically.
> If using Vercel's built-in Turborepo integration, set `Root Directory` and let Vercel
> handle the build command.

---

## Step 2 — Environment variables

### gci-web (gci-index.com)

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...` | Supabase connection string |
| `NEXT_PUBLIC_BASE_URL` | `https://gci-index.com` | Used in sitemap, OG, RSS |
| `RESEND_API_KEY` | `re_...` | For newsletter subscription confirm emails |
| `RESEND_FROM_EMAIL` | `GCI <noreply@gci-index.com>` | Must be verified domain |
| `RESEND_WEBHOOK_SECRET` | `whsec_...` | Resend → Webhooks → Signing Secret |
| `NEWSLETTER_SEND_ENABLED` | `false` | Set `true` only after full checklist |

### gci-data (gci-data.com)

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...` | Same Supabase DB as gci-web |
| `NEXT_PUBLIC_BASE_URL` | `https://gci-index.com` | Used in newsletter email links |
| `CRON_SECRET` | `<random 32-char secret>` | Shared with Vercel Cron config |
| `ADMIN_USER` | `admin` | HTTP Basic Auth username |
| `ADMIN_PASSWORD` | `<strong password>` | HTTP Basic Auth password |
| `TWITTER_API_KEY` | `...` | OAuth 1.0a Consumer Key |
| `TWITTER_API_SECRET` | `...` | OAuth 1.0a Consumer Secret |
| `TWITTER_ACCESS_TOKEN` | `...` | OAuth 1.0a Access Token |
| `TWITTER_ACCESS_SECRET` | `...` | OAuth 1.0a Access Token Secret |
| `DISCORD_WEBHOOK_URL` | `https://discord.com/api/webhooks/...` | Discord channel webhook |
| `RESEND_API_KEY` | `re_...` | For newsletter daily send |
| `RESEND_FROM_EMAIL` | `GCI <noreply@gci-index.com>` | Must be verified domain |
| `RESEND_WEBHOOK_SECRET` | `whsec_...` | Same as gci-web |
| `NEWSLETTER_SEND_ENABLED` | `false` | Toggle to `true` when ready |

---

## Step 3 — Domain configuration

```
gci-index.com  →  gci-web  Vercel project
gci-data.com   →  gci-data Vercel project
```

In Vercel Dashboard for each project:
- Settings → Domains → Add `gci-index.com` / `gci-data.com`
- Set up DNS at your registrar (CNAME → `cname.vercel-dns.com` or A records)

---

## Step 4 — Resend webhook registration

After gci-data.com is live:

1. Go to [https://resend.com/webhooks](https://resend.com/webhooks)
2. Add endpoint: `https://gci-data.com/api/v1/webhooks/resend`
3. Subscribe to events: `email.bounced`, `email.complained`
4. Copy **Signing Secret** → set as `RESEND_WEBHOOK_SECRET` in **both** gci-web and gci-data

---

## Step 5 — Cron verification

After gci-data.com is live, verify each cron endpoint manually:

```bash
# Replace with your CRON_SECRET value
SECRET="<your-cron-secret>"
BASE="https://gci-data.com"

# Price fetch (runs */10 min)
curl -H "Authorization: Bearer $SECRET" "$BASE/api/v1/cron/fetch?dry=1"

# Recalc (runs hourly)
curl -H "Authorization: Bearer $SECRET" "$BASE/api/v1/cron/recalc?dry=1"

# Daily snapshot (runs 00:00 UTC)
curl -H "Authorization: Bearer $SECRET" "$BASE/api/v1/cron/daily-snapshot?dry=1"

# X post (runs 01:00 UTC)
curl -H "Authorization: Bearer $SECRET" "$BASE/api/v1/cron/daily-post?dry=1"

# Discord post (runs 02:00 UTC)
curl -H "Authorization: Bearer $SECRET" "$BASE/api/v1/cron/daily-discord?dry=1"

# Newsletter (runs 01:00 UTC)
curl -H "Authorization: Bearer $SECRET" "$BASE/api/v1/cron/daily-newsletter?dry=1"
```

All should return `{ "ok": true, "mode": "dry", ... }`.

Also verify the health endpoints:

```bash
# Public health check (no auth needed)
curl https://gci-index.com/api/v1/health
# Expected: { "ok": true, "checks": { "db": { "ok": true, ... }, "index": { "ok": true, ... } } }

# Cron health check (dry — no Discord alert sent)
curl -H "Authorization: Bearer $SECRET" "$BASE/api/v1/cron/health?dry=1"
# Expected: { "ok": true, "checks": [...], "alerted": false }

# Test Discord alert (sends to DISCORD_WEBHOOK_URL)
curl -H "Authorization: Bearer $SECRET" "$BASE/api/v1/cron/health?force=1"
```

---

## Step 6 — Admin access

1. Go to `https://gci-data.com/admin/prices`
2. Enter `ADMIN_USER` / `ADMIN_PASSWORD` when prompted
3. Verify all admin pages load: Prices, Sources, Index, Logs, Distribution, Newsletter

---

## Step 7 — Newsletter live-send activation

Only proceed after:
- [ ] `/admin/newsletter` shows `active > 0` real subscribers
- [ ] `bounced = 0` (or expected value)
- [ ] `?dry=1` curl returns correct subscriber count
- [ ] `?test=your@email.com` received and links work
- [ ] Resend Webhook registered and `RESEND_WEBHOOK_SECRET` set
- [ ] `List-Unsubscribe` link in test email works

When ready, set `NEWSLETTER_SEND_ENABLED=true` in gci-data Vercel env vars.  
No redeployment needed — takes effect on next cron run.

---

## Step 8 — Observability setup (Week 13)

### Uptime monitor (external)

Set up an external HTTP monitor for the public health endpoint:

| Setting | Value |
|---------|-------|
| URL | `https://gci-index.com/api/v1/health` |
| Type | HTTP keyword |
| Keyword | `"ok":true` |
| Interval | 5 minutes |
| Alert | Email / SMS on failure |

Recommended services: UptimeRobot (free tier), Better Uptime, Checkly.

### Cron health check (internal)

`/api/v1/cron/health` runs every 30 minutes via Vercel Cron and sends a Discord embed to `DISCORD_WEBHOOK_URL` if any cron is overdue or errored.

Required gci-data env var (already in the list above):
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Manual test:
```bash
# Check health without alerting
curl -H "Authorization: Bearer $SECRET" "$BASE/api/v1/cron/health?dry=1"

# Force-send a Discord test alert (all green)
curl -H "Authorization: Bearer $SECRET" "$BASE/api/v1/cron/health?force=1"
```

### Admin Logs page

Visit `https://gci-data.com/admin/logs` to see:
- Health summary (Healthy / Stale / Error counts)
- Per-cron last run time, age, and duration
- Last 50 runs across all crons

### GitHub Actions Discord notification

Add `DISCORD_WEBHOOK_URL` to GitHub Secrets (Settings → Secrets and variables → Actions) to receive a Discord DM when the daily backup fails.

---

## Step 9 — GitHub Actions backup

After pushing to GitHub, verify the backup workflow runs correctly:

1. Go to **Actions → Daily DB Backup → Run workflow** (manual trigger)
2. Confirm the run succeeds and an artifact `gci-db-backup-<run_id>` is uploaded
3. Required secret: `DATABASE_URL` (Settings → Secrets and variables → Actions)
4. Optional S3 secrets: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`

The script runs at **03:30 UTC** (30 min after the Vercel integrity-check cron at 03:00).
Artifacts are retained for **30 days** automatically.

For local use:
```bash
chmod +x scripts/backup.sh
DATABASE_URL="postgresql://..." bash scripts/backup.sh
# or dry run:
DRY_RUN=1 DATABASE_URL="postgresql://..." bash scripts/backup.sh
```

---

## Step 10 — Cleanup (after production is stable)

```bash
# Remove old root src/ directory
rm -rf src/

# Optional: remove old root-level config files that are no longer used
# (keep vercel.json as reference, or delete it)
git add -A && git commit -m "chore: remove legacy root src/ after monorepo migration"
```

---

## Dependency graph (for reference)

```
gci-index.com (apps/web)           gci-data.com (apps/data)
       │                                    │
       ├── @gci/core ──────────────────────┤
       │       └── @gci/db                 │
       │       └── @gci/email              │
       └── @gci/db                  ───────┘
       └── @gci/email

Shared: DATABASE_URL (same Supabase instance)
```
