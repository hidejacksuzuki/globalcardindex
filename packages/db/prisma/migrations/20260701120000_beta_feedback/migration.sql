-- Migration: Create BetaFeedback table
-- Run this in Supabase SQL Editor (cannot run via prisma migrate deploy due to DIRECT_URL restriction)

CREATE TABLE IF NOT EXISTS "BetaFeedback" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT,
  "type"        TEXT NOT NULL,
  "message"     TEXT NOT NULL,
  "cardName"    TEXT,
  "currentPath" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'open',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BetaFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BetaFeedback_status_idx"    ON "BetaFeedback"("status");
CREATE INDEX IF NOT EXISTS "BetaFeedback_type_idx"      ON "BetaFeedback"("type");
CREATE INDEX IF NOT EXISTS "BetaFeedback_createdAt_idx" ON "BetaFeedback"("createdAt");

-- RLS: 前回の enable_rls migration と同様に、anon からの直接アクセスはブロック
-- （API 経由でのみ書き込み・閲覧を許可する想定。service_role/postgres はバイパス）
ALTER TABLE "BetaFeedback" ENABLE ROW LEVEL SECURITY;
