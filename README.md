# Global Card Index (GCI)

Price transparency infrastructure for trading cards. MVP focused on data ingestion, indexing, and read APIs. No trading, grading, or payments.

## Stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS
- PostgreSQL + Prisma
- Vercel deployable

## Setup

1. Install dependencies

   ```
   npm install
   ```

2. Configure environment

   ```
   cp .env.example .env
   # Edit DATABASE_URL to point at your Postgres instance
   ```

3. Initialize the database

   ```
   npx prisma migrate dev --name init
   ```

4. (Optional) Seed with the sample CSV

   ```
   npm run import-csv -- sample-data/sample.csv
   ```

5. Compute the first index value

   ```
   npm run recalc-index
   ```

6. Run the dev server

   ```
   npm run dev
   ```

## Scripts

- `npm run dev` — start Next.js dev server
- `npm run build` — production build (runs `prisma generate` first)
- `npm run import-csv -- <path>` — import a CSV of price observations
- `npm run recalc-index` — recompute and persist the GCI index value
- `npm run prisma:studio` — open Prisma Studio

## Routes

| Path                              | Description                                |
| --------------------------------- | ------------------------------------------ |
| `/`                               | Landing — current GCI index                |
| `/indices`                        | Index history                              |
| `/marketboard`                    | Per-card latest prices and movement        |
| `/cards`                          | Card catalog (search + pagination)         |
| `/cards/[id]`                     | Card detail with price history             |
| `GET /api/v1/index`               | Latest IndexValue                          |
| `GET /api/v1/cards`               | Cards — `?q=&page=&pageSize=` (max 100)    |
| `GET /api/v1/cards/[id]`          | Card detail with price history             |
| `GET /api/v1/marketboard`         | Marketboard — `?q=&sort=&order=`           |
| `GET\|POST /api/v1/cron/recalc`   | Recalculate index (CRON_SECRET protected)  |

## Project layout

```
src/
  app/                 # App Router pages + API routes (versioned under /api/v1)
  actions/             # Server-side data access (used by pages and API routes)
  components/
    layout/            # Header, shells
    index/             # GCI index UI (IndexHero w/ inline sparkline)
    cards/             # Card-domain UI (PriceHistory)
    market/            # Marketboard UI (MarketTable)
    ui/                # Shared primitives (Card, SearchBar)
  lib/
    prisma.ts          # PrismaClient singleton
    engine/            # Index calculation, trust score, liquidity, volatility
    collectors/        # Data ingestion (csv now; mercari/ebay/snkrdunk later)
    utils/             # formatPrice, formatDate, normalizeTitle
  jobs/                # Background-job entry points (called from scripts/cron)
  types/               # Domain types (card / market / api)
prisma/                # schema.prisma + migrations
scripts/               # CLI entry points (import-csv, recalc-index)
sample-data/           # Example inputs
```

## CSV format

```
Date,Card Name,Set,Rarity,Condition,Price,Currency,Source Type,Source Name,URL/Reference,Volume,Observed By,Trust Score,Notes
```

`Trust Score` is optional — if blank, the source's `defaultTrustScore` is used.

## Index calculation (MVP)

1. Pull `Price` rows in the trailing 30-day window
2. Trim the top and bottom 5% by count
3. Weighted average by `trustScore`
4. Index value = `currentAggregate / firstWindowAggregate * 1000`

The first ever calculation produces value `1000`. Subsequent runs are scaled against the first 30-day window's weighted aggregate. `changeRate` is the % change vs the previous stored `IndexValue`.

## Scheduled recalculation (Vercel Cron)

`vercel.json` declares an hourly cron that hits `/api/v1/cron/recalc`. The endpoint authorizes via `Authorization: Bearer <CRON_SECRET>`:

- In Vercel, set `CRON_SECRET` as a Project Environment Variable. Vercel Cron sends the bearer header automatically.
- Locally, you can leave `CRON_SECRET` blank — the endpoint accepts unauthenticated calls when `NODE_ENV !== "production"`.
- For ad-hoc invocation:

  ```
  curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
    https://<your-deployment>/api/v1/cron/recalc
  ```

Adjust the schedule in `vercel.json` (cron syntax) as needed.
