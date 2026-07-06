-- Migration: Add noon/evening X post tracking to DailyRecapSnapshot
-- Run this in Supabase SQL Editor (cannot run via prisma migrate deploy due to DIRECT_URL restriction)

ALTER TABLE "DailyRecapSnapshot"
  ADD COLUMN IF NOT EXISTS "noonTweetId"      TEXT,
  ADD COLUMN IF NOT EXISTS "noonTweetedAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "noonTweetUrl"     TEXT,
  ADD COLUMN IF NOT EXISTS "eveningTweetId"   TEXT,
  ADD COLUMN IF NOT EXISTS "eveningTweetedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "eveningTweetUrl"  TEXT;
