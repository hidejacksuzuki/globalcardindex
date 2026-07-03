-- Migration: Add partial-failure tracking to RecalcLog
-- Run this in Supabase SQL Editor (cannot run via prisma migrate deploy due to DIRECT_URL restriction)

ALTER TABLE "RecalcLog"
  ADD COLUMN IF NOT EXISTS "cardsFailed" INTEGER,
  ADD COLUMN IF NOT EXISTS "failedBreakdown" JSONB;
