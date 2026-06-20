-- CreateTable
CREATE TABLE "PortfolioCard" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "cardId"      TEXT NOT NULL,
    "quantity"    INTEGER NOT NULL DEFAULT 1,
    "avgBuyPrice" DOUBLE PRECISION,
    "memo"        TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioCard_userId_cardId_key" ON "PortfolioCard"("userId", "cardId");

-- CreateIndex
CREATE INDEX "PortfolioCard_userId_idx" ON "PortfolioCard"("userId");

-- CreateIndex
CREATE INDEX "PortfolioCard_cardId_idx" ON "PortfolioCard"("cardId");

-- CreateIndex
CREATE INDEX "PortfolioCard_userId_createdAt_idx" ON "PortfolioCard"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PortfolioCard" ADD CONSTRAINT "PortfolioCard_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCard" ADD CONSTRAINT "PortfolioCard_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
