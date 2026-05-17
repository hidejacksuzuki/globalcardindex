import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/prisma";
import { clampTrustScore, DEFAULT_TRUST } from "@/lib/engine/trustScore";
import { attachFingerprint } from "@/lib/engine/fingerprint";
import { computeTrustScore } from "@/lib/engine/trustScore";
import { normalizeListingType } from "@/lib/engine/sourceNormalizer";

// ----------------------------------------------------------------
// GCI 標準 CSV フォーマット
// ----------------------------------------------------------------
type CsvRow = {
  Date:             string;
  "Card Name":      string;
  Set:              string;
  Rarity:           string;
  Condition:        string;
  Price:            string;
  Currency:         string;
  "Source Type":    string;
  "Source Name":    string;
  "URL/Reference":  string;
  "Listing Type":   string;  // Week 3 追加
  "Seller Score":   string;  // Week 3 追加
  Availability:     string;  // Week 3 追加
  Volume:           string;
  "Observed By":    string;
  "Trust Score":    string;
  Notes:            string;
};

export type ImportSummary = {
  totalRows: number;
  imported:  number;
  skipped:   number;
  duplicate: number;
  errors:    { row: number; reason: string }[];
};

// ----------------------------------------------------------------
// importCsv
// Week 3 変更点:
//   - fingerprint で重複排除（@unique 制約 + skipDuplicates）
//   - urlHash を URL から生成
//   - listingType の正規化
//   - trust score v2 で自動計算
// ----------------------------------------------------------------
export async function importCsv(
  buffer: Buffer | string,
): Promise<ImportSummary> {
  const records = parse(buffer, {
    columns:           true,
    skip_empty_lines:  true,
    trim:              true,
  }) as CsvRow[];

  const summary: ImportSummary = {
    totalRows: records.length,
    imported:  0,
    skipped:   0,
    duplicate: 0,
    errors:    [],
  };

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    try {
      const price      = Number(row.Price);
      const observedAt = new Date(row.Date);

      if (
        !row["Card Name"] ||
        !row.Set          ||
        !row.Rarity       ||
        !row.Condition    ||
        Number.isNaN(price) ||
        Number.isNaN(observedAt.getTime())
      ) {
        summary.skipped++;
        summary.errors.push({ row: i + 2, reason: "missing or invalid required field" });
        continue;
      }

      const sourceType = row["Source Type"] || "unknown";
      const sourceName = row["Source Name"] || "unknown";
      const url        = row["URL/Reference"] || null;

      // ── Source upsert（Week 3: @@unique を name のみに変更済み）──
      const source = await prisma.source.upsert({
        where:  { name: sourceName },
        create: { name: sourceName, type: sourceType, defaultTrustScore: DEFAULT_TRUST },
        update: { type: sourceType },
      });

      // ── Card upsert ──
      const card = await prisma.card.upsert({
        where: {
          name_setName_rarity_condition: {
            name:      row["Card Name"],
            setName:   row.Set,
            rarity:    row.Rarity,
            condition: row.Condition,
          },
        },
        create: {
          name:      row["Card Name"],
          setName:   row.Set,
          rarity:    row.Rarity,
          condition: row.Condition,
        },
        update: {},
      });

      // ── Listing type 正規化 ──
      const rawListingType = row["Listing Type"] || null;
      const listingType    = rawListingType
        ? normalizeListingType(rawListingType)
        : "unknown";

      // ── Seller score ──
      const sellerScore = row["Seller Score"]?.trim()
        ? Math.min(1.0, Math.max(0.0, Number(row["Seller Score"]) / 100))
        : null;

      // ── Fingerprint & urlHash ──
      const enriched = attachFingerprint({
        cardId:     card.id,
        price,
        observedAt,
        url,
        sourceName,
      });

      // ── Trust score v2 ──
      const manualScore = row["Trust Score"]?.trim()
        ? clampTrustScore(Number(row["Trust Score"]))
        : null;

      const trustScore = manualScore ?? computeTrustScore({
        sourceDefaultScore: source.defaultTrustScore,
        sourceTrustWeight:  source.trustWeight,
        sellerScore,
        listingType,
      });

      // ── Insert（fingerprint @unique で重複は無視）──
      const result = await prisma.price.createMany({
        data: [{
          cardId:         card.id,
          price,
          currency:       row.Currency || "JPY",
          sourceType,
          sourceName,
          sourceId:       source.id,
          observedAt,
          listingType,
          rawListingType,
          sellerScore,
          availability:   row.Availability || null,
          fingerprint:    enriched.fingerprint,
          urlHash:        enriched.urlHash,
          trustScore,
          notes:          row.Notes || null,
        }],
        skipDuplicates: true,  // fingerprint @unique が重複排除の主役
      });

      if (result.count === 0) {
        summary.duplicate++;
      } else {
        summary.imported++;
      }

    } catch (err) {
      summary.skipped++;
      summary.errors.push({
        row:    i + 2,
        reason: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return summary;
}
