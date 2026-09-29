-- 公式カード番号を Card に追加（表示・出品タイトル照合用。既存行は NULL のまま）
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "cardNumber" TEXT;
CREATE INDEX IF NOT EXISTS "Card_cardNumber_idx" ON "Card" ("cardNumber");
