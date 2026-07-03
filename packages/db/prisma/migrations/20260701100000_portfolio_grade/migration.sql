-- Migration: Add grade field to PortfolioCard
-- Run this in Supabase SQL Editor (cannot run via prisma migrate deploy due to DIRECT_URL restriction)

ALTER TABLE "PortfolioCard"
  ADD COLUMN IF NOT EXISTS "grade" TEXT NOT NULL DEFAULT 'RAW';
