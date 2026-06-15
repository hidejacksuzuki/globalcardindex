-- Card 管理フラグ追加（isVisible / deletedAt / mergedIntoCardId）

ALTER TABLE "Card" ADD COLUMN "isVisible"        BOOLEAN   NOT NULL DEFAULT true;
ALTER TABLE "Card" ADD COLUMN "deletedAt"        TIMESTAMP(3);
ALTER TABLE "Card" ADD COLUMN "mergedIntoCardId" TEXT;
ALTER TABLE "Card" ADD COLUMN "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- self-relation FK
ALTER TABLE "Card" ADD CONSTRAINT "Card_mergedIntoCardId_fkey"
    FOREIGN KEY ("mergedIntoCardId") REFERENCES "Card"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- インデックス
CREATE INDEX "Card_isVisible_idx" ON "Card"("isVisible");
CREATE INDEX "Card_deletedAt_idx" ON "Card"("deletedAt");
