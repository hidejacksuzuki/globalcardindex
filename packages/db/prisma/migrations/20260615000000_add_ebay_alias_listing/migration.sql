-- CreateTable: CardAlias
CREATE TABLE "CardAlias" (
    "id"               TEXT NOT NULL,
    "cardId"           TEXT NOT NULL,
    "locale"           TEXT NOT NULL DEFAULT 'en',
    "name"             TEXT NOT NULL,
    "setName"          TEXT,
    "cardNumber"       TEXT,
    "rarity"           TEXT,
    "language"         TEXT,
    "market"           TEXT NOT NULL DEFAULT 'US',
    "searchQuery"      TEXT,
    "negativeKeywords" TEXT NOT NULL DEFAULT 'PSA,BGS,CGC,graded,slab,proxy,custom,fan made,lot,bulk,sealed,booster,pack,box,case,digital,code',
    "isPrimary"        BOOLEAN NOT NULL DEFAULT false,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EbayListing
CREATE TABLE "EbayListing" (
    "id"                  TEXT NOT NULL,
    "cardId"              TEXT NOT NULL,
    "cardAliasId"         TEXT,
    "source"              TEXT NOT NULL DEFAULT 'ebay',
    "market"              TEXT NOT NULL DEFAULT 'US',
    "title"               TEXT NOT NULL,
    "price"               DOUBLE PRECISION NOT NULL,
    "currency"            TEXT NOT NULL DEFAULT 'USD',
    "shippingPrice"       DOUBLE PRECISION,
    "totalPrice"          DOUBLE PRECISION NOT NULL,
    "soldAt"              TIMESTAMP(3),
    "listingUrl"          TEXT,
    "imageUrl"            TEXT,
    "sellerName"          TEXT,
    "sellerFeedbackScore" INTEGER,
    "listingType"         TEXT NOT NULL DEFAULT 'sold',
    "conditionText"       TEXT,
    "languageDetected"    TEXT,
    "matchScore"          INTEGER NOT NULL DEFAULT 0,
    "status"              TEXT NOT NULL DEFAULT 'pending',
    "rejectReason"        TEXT,
    "priceJpy"            DOUBLE PRECISION,
    "priceUsd"            DOUBLE PRECISION,
    "rawJson"             JSONB,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EbayListing_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: CardAlias → Card
ALTER TABLE "CardAlias" ADD CONSTRAINT "CardAlias_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: EbayListing → Card
ALTER TABLE "EbayListing" ADD CONSTRAINT "EbayListing_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: EbayListing → CardAlias
ALTER TABLE "EbayListing" ADD CONSTRAINT "EbayListing_cardAliasId_fkey"
    FOREIGN KEY ("cardAliasId") REFERENCES "CardAlias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: CardAlias
CREATE INDEX "CardAlias_cardId_idx" ON "CardAlias"("cardId");
CREATE INDEX "CardAlias_locale_idx" ON "CardAlias"("locale");
CREATE INDEX "CardAlias_market_idx" ON "CardAlias"("market");

-- CreateIndex: EbayListing
CREATE INDEX "EbayListing_cardId_idx"       ON "EbayListing"("cardId");
CREATE INDEX "EbayListing_cardAliasId_idx"  ON "EbayListing"("cardAliasId");
CREATE INDEX "EbayListing_status_idx"       ON "EbayListing"("status");
CREATE INDEX "EbayListing_listingType_idx"  ON "EbayListing"("listingType");
CREATE INDEX "EbayListing_soldAt_idx"       ON "EbayListing"("soldAt");
CREATE INDEX "EbayListing_matchScore_idx"   ON "EbayListing"("matchScore");
CREATE INDEX "EbayListing_createdAt_idx"    ON "EbayListing"("createdAt");
