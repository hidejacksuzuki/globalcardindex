import { z } from "zod";

// ----------------------------------------------------------------
// IndexValue（DB の IndexValue モデルに対応）
// ----------------------------------------------------------------
export const indexValueSchema = z.object({
  id:          z.string(),
  value:       z.number(),
  changeRate:  z.number(),
  calculatedAt: z.coerce.date(),
});

export type IndexValue = z.infer<typeof indexValueSchema>;

// ----------------------------------------------------------------
// チャート用スナップショット（id なし・軽量）
// ----------------------------------------------------------------
export const indexSnapshotSchema = z.object({
  value:        z.number(),
  changeRate:   z.number(),
  calculatedAt: z.coerce.date(),
});

export type IndexSnapshot = z.infer<typeof indexSnapshotSchema>;

// ----------------------------------------------------------------
// リクエストスキーマ
// ----------------------------------------------------------------
export const listIndexQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(365).default(60),
});

export const chartQuerySchema = z.object({
  days:  z.coerce.number().int().min(1).max(365).default(90),
  limit: z.coerce.number().int().min(1).max(365).default(90),
});

export type ListIndexQuery = z.infer<typeof listIndexQuerySchema>;
export type ChartQuery     = z.infer<typeof chartQuerySchema>;

// ----------------------------------------------------------------
// レスポンス型
// ----------------------------------------------------------------
export const indexListResponseSchema = z.object({
  data: z.array(indexValueSchema),
});

export const indexLatestResponseSchema = z.object({
  data: indexValueSchema,
});

export const indexChartResponseSchema = z.object({
  data: z.array(indexSnapshotSchema),
});

export const indexCalculateResponseSchema = z.object({
  data: z.object({
    saved:       z.literal(true),
    id:          z.string(),
    value:       z.number(),
    changeRate:  z.number(),
    sampleCount: z.number().int(),
  }),
});

export type IndexListResponse      = z.infer<typeof indexListResponseSchema>;
export type IndexLatestResponse    = z.infer<typeof indexLatestResponseSchema>;
export type IndexChartResponse     = z.infer<typeof indexChartResponseSchema>;
export type IndexCalculateResponse = z.infer<typeof indexCalculateResponseSchema>;
