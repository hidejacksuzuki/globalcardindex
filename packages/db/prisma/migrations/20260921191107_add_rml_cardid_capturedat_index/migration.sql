-- サムネイル取得（DISTINCT ON ("cardId") ... ORDER BY "cardId", "capturedAt" DESC）が
-- RawMarketListing 22.7万行でサーバー実測6.2秒かかっていた問題の修正。
CREATE INDEX IF NOT EXISTS "RawMarketListing_cardId_capturedAt_idx"
  ON "RawMarketListing" ("cardId", "capturedAt");
