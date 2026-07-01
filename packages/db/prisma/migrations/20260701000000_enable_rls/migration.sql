-- Enable Row-Level Security on all public schema tables
-- Prisma connects as postgres/service_role which bypasses RLS automatically.
-- This blocks Supabase PostgREST (anon/authenticated roles) from raw table access.

-- ─── Enable RLS ───────────────────────────────────────────────────────────────

ALTER TABLE "Card"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Price"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Source"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IndexValue"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecalcLog"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyRecapSnapshot"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterSubscriber" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NewsletterRunLog"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Watchlist"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WatchlistItem"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CronLog"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BackupLog"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CollectorRun"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserWatchlistItem"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPrefs"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SourceSearchUrl"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RawAuctionResult"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RawListing"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceSnapshot"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CardRequest"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CardCandidate"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CardAlias"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EbayListing"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RawMarketListing"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortfolioCard"        ENABLE ROW LEVEL SECURITY;

-- ─── Public read-only policies ────────────────────────────────────────────────
-- Only Card and IndexValue are genuinely public; all else stays locked.

CREATE POLICY "anon_read_cards" ON "Card"
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_index_values" ON "IndexValue"
  FOR SELECT TO anon USING (true);

-- DailyRecapSnapshot is used for the public /daily page (no PII).
CREATE POLICY "anon_read_daily_recap" ON "DailyRecapSnapshot"
  FOR SELECT TO anon USING (true);

-- Price history is public data (no PII).
CREATE POLICY "anon_read_prices" ON "Price"
  FOR SELECT TO anon USING (true);

-- ─── Everything else: no anon / authenticated policies ────────────────────────
-- Default-deny: with RLS enabled and no policy, all access is blocked for
-- anon and authenticated roles. Prisma (postgres role) bypasses RLS.
