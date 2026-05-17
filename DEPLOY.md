# Deployment Guide

This project deploys as **two separate Vercel projects** from a pnpm monorepo.

| Vercel project | Root directory | Public URL |
|---|---|---|
| `gci-web` | `apps/web` | gci-index.com |
| `gci-data` | `apps/data` | gci-data.com (internal) |

Both projects share the same PostgreSQL database.

---

## Why `pnpm build` passes without `DATABASE_URL`

At build time, Next.js tries to pre-render ISR pages (trending, gainers, losers, daily, games/\[slug\], sitemap.xml). Each of these wraps its DB call in `.catch(() => [])` / `.catch(() => null)`, so a missing database produces empty pages rather than a build failure.

In Vercel deployments `DATABASE_URL` is always set, so pages pre-render with real data.

Two `next.config.js` settings make Prisma work in the monorepo at runtime:
- `experimental.serverComponentsExternalPackages: ["@prisma/client", "prisma"]` — keeps Prisma out of the webpack bundle so it uses its native binary.
- `experimental.outputFileTracingRoot` — lets Next.js's file tracer walk up to the monorepo root to find the pnpm virtual store where the Prisma binary lives.

Local `.prisma/client` symlinks are listed in `.gitignore` and are **not committed**. Vercel recreates them automatically during `pnpm install` because `@prisma/client` is in `pnpm.onlyBuiltDependencies`.

---

## Initial commit (first time)

```bash
cd /path/to/Global\ Card\ Index
git init
git add .
git status          # verify .prisma/ dirs are absent, .env is absent
git commit -m "Initial commit"
gh repo create globalcardindex --private --source=. --push   # or use the GitHub UI
```

---

## Vercel environment variables

Set these in **Project Settings → Environment Variables** for each project.

### apps/web — gci-index.com

#### Required

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `postgresql://...` — same DB as data app |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_RESEND_KEY` | Resend API key for magic-link emails |
| `RESEND_API_KEY` | Resend API key for newsletter |
| `RESEND_FROM_EMAIL` | `GCI <noreply@globalcardindex.com>` |

#### Optional / launch later

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | `https://globalcardindex.com` | Set only if using a custom domain |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | _(off)_ | Plausible Analytics domain |
| `NEXT_PUBLIC_DISCORD_INVITE` | _(off)_ | Invite URL shown on /beta page |
| `NEXT_PUBLIC_APP_VERSION` | _(empty)_ | Shown in /api/v1/health response |
| `RESEND_WEBHOOK_SECRET` | _(off)_ | Required only if enabling Resend bounce webhook |

---

### apps/data — gci-data.com

#### Required

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Same DB as web app |
| `CRON_SECRET` | `openssl rand -base64 32` — Vercel Cron sends this as Bearer token |
| `ADMIN_PASSWORD` | HTTP Basic Auth for /admin/\* (503 without it in production) |

#### Required for email features (newsletter / alerts)

| Variable | Notes |
|---|---|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | `GCI <noreply@globalcardindex.com>` |
| `RESEND_WEBHOOK_SECRET` | Resend signing secret — from Resend dashboard → Webhooks |

#### Optional — notification channels

| Variable | Notes |
|---|---|
| `ADMIN_USER` | Basic Auth username (default: `admin`) |
| `DISCORD_WEBHOOK_URL` | Cron health alerts |
| `DISCORD_WEBHOOK_ALERTS` | Market alert posts (±10% cards) |
| `DISCORD_WEBHOOK_RISING` | Rising-cards channel |
| `DISCORD_WEBHOOK_LOG` | Collector log channel |
| `BACKUP_ALERT_EMAIL` | Email on backup anomaly |

#### Optional — X (Twitter) auto-post

| Variable | Notes |
|---|---|
| `TWITTER_API_KEY` | OAuth 1.0a Consumer Key |
| `TWITTER_API_SECRET` | OAuth 1.0a Consumer Secret |
| `TWITTER_ACCESS_TOKEN` | Access Token (Read+Write) |
| `TWITTER_ACCESS_SECRET` | Access Secret |

#### Feature flags (off by default, toggle without redeploy)

| Variable | Default | Notes |
|---|---|---|
| `NEWSLETTER_SEND_ENABLED` | `false` | Enable daily newsletter sends |
| `ALERT_SEND_ENABLED` | `false` | Enable watchlist alert emails |
| `ALERT_THRESHOLD_PCT` | `15` | % change threshold for alerts |
| `ALERT_LOOKBACK_HOURS` | `4` | Hours of IndexValue history to scan |
| `WEEKLY_SEND_ENABLED` | `false` | Enable weekly recap emails |

---

## Vercel project setup

1. Import the repo in Vercel. Set **Root Directory** to `apps/web` (or `apps/data`).
2. Vercel auto-detects pnpm and Next.js — no build command override needed.
3. Set environment variables above.
4. For the data app, confirm `vercel.json` crons at the repo root are associated with the correct project.

### Enable Prisma generate on Vercel

The root `package.json` includes `pnpm.onlyBuiltDependencies` with `@prisma/client`. This triggers `prisma generate` automatically during `pnpm install` on Vercel — no manual postinstall script is needed.

---

## Pre-launch checklist

- [ ] `DATABASE_URL` set and migrations applied (`pnpm db:migrate`)
- [ ] `AUTH_SECRET` set in web app
- [ ] `CRON_SECRET` set in data app and matches the value Vercel Cron sends
- [ ] `ADMIN_PASSWORD` set in data app
- [ ] `RESEND_API_KEY` verified with a test send (`?test=your@email.com`)
- [ ] Resend domain verified (MX / SPF / DKIM)
- [ ] Preview Deploy accessed and no 500 errors in logs
- [ ] `/api/v1/health` returns `"ok": true`
- [ ] Cron health check via `/api/v1/cron/health?dry=1` returns expected schedules
