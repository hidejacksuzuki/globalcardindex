import { z } from "zod";
import { priceRecordSchema } from "./cards";
import { paginationSchema } from "./common";

// ----------------------------------------------------------------
// リクエストスキーマ（GET クエリ）
// ----------------------------------------------------------------
export const listPricesQuerySchema = z.object({
  cardId:     z.string(),
  from:       z.string().datetime().optional(),
  to:         z.string().datetime().optional(),
  sourceType: z.string().optional(),
  sourceName: z.string().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(200).default(50),
});

export type ListPricesQuery = z.infer<typeof listPricesQuerySchema>;

// ----------------------------------------------------------------
// リクエストスキーマ（POST body）
// ----------------------------------------------------------------
export const createPriceBodySchema = z.object({
  cardId:     z.string(),
  price:      z.number().positive(),
  currency:   z.string().default("JPY"),
  sourceType: z.string().default("manual"),
  sourceName: z.string().default("manual"),
  observedAt: z.string().datetime().optional(),
  trustScore: z.number().int().min(0).max(100).default(50),
  notes:      z.string().optional(),
});

export const bulkPricesBodySchema = z.object({
  prices: z
    .array(createPriceBodySchema.extend({
      sourceType: z.string().default("csv_import"),
      sourceName: z.string().default("csv_import"),
    }))
    .min(1)
    .max(1000),
});

export type CreatePriceBody = z.infer<typeof createPriceBodySchema>;
export type BulkPricesBody  = z.infer<typeof bulkPricesBodySchema>;

// ----------------------------------------------------------------
// レスポンス型
// ----------------------------------------------------------------
export const priceListResponseSchema = z.object({
  data: z.array(priceRecordSchema),
  meta: paginationSchema,
});

export const priceDetailResponseSchema = z.object({
  data: priceRecordSchema,
});

export const bulkCreateResponseSchema = z.object({
  data: z.object({ count: z.number().int().nonnegative() }),
});

export type PriceListResponse   = z.infer<typeof priceListResponseSchema>;
export type PriceDetailResponse = z.infer<typeof priceDetailResponseSchema>;
export type BulkCreateResponse  = z.infer<typeof bulkCreateResponseSchema>;
