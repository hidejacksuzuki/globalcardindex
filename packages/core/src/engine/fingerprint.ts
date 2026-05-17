import { createHash } from "crypto";

// ----------------------------------------------------------------
// urlHash
// 出品 URL の SHA-256 前 16 byte（重複検知用、URL なければ null）
// ----------------------------------------------------------------
export function hashUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return createHash("sha256").update(url.trim()).digest("hex").slice(0, 32);
}

// ----------------------------------------------------------------
// fingerprint
// cardId + urlHash + price + observedAt の組み合わせから生成する
// 完全一致レコードの @unique 制約として使う
//
// URL がない場合（手動入力など）は
//   cardId + sourceName + price + observedAt（分単位に丸め）
// でフォールバックする
// ----------------------------------------------------------------
export type FingerprintInput = {
  cardId:     string;
  price:      number;
  observedAt: Date;
  urlHash?:   string | null;
  sourceName?: string;
};

export function buildFingerprint(input: FingerprintInput): string {
  // observedAt は分単位に丸めて、秒単位のブレを吸収
  const ts = Math.floor(input.observedAt.getTime() / 60_000);

  const key = input.urlHash
    ? `${input.cardId}:url:${input.urlHash}:${input.price}:${ts}`
    : `${input.cardId}:src:${input.sourceName ?? ""}:${input.price}:${ts}`;

  return createHash("sha256").update(key).digest("hex").slice(0, 40);
}

// ----------------------------------------------------------------
// 一括生成ヘルパー（CSV import / bulk insert で使う）
// ----------------------------------------------------------------
export type PriceInputForFingerprint = {
  cardId:     string;
  price:      number;
  observedAt: Date | string;
  url?:       string | null;
  sourceName?: string;
};

export function attachFingerprint<T extends PriceInputForFingerprint>(
  row: T,
): T & { urlHash: string | null; fingerprint: string } {
  const observedAt =
    typeof row.observedAt === "string" ? new Date(row.observedAt) : row.observedAt;
  const urlHash     = hashUrl(row.url);
  const fingerprint = buildFingerprint({
    cardId:     row.cardId,
    price:      row.price,
    observedAt,
    urlHash,
    sourceName: row.sourceName,
  });
  return { ...row, urlHash, fingerprint };
}
