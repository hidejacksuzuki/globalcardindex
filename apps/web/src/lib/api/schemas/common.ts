import { z } from "zod";

// ----------------------------------------------------------------
// ページネーション
// ----------------------------------------------------------------
export const paginationSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  page:       z.number().int().positive(),
  pageSize:   z.number().int().positive(),
  totalPages: z.number().int().positive(),
});

export type Pagination = z.infer<typeof paginationSchema>;

// ----------------------------------------------------------------
// レスポンスラッパー
// data のみ / data + meta（ページネーション付き）
// ----------------------------------------------------------------
export const apiDataSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({ data: dataSchema });

export const apiListSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: paginationSchema,
  });

export type ApiData<T> = { data: T };
export type ApiList<T> = { data: T[]; meta: Pagination };

// ----------------------------------------------------------------
// エラー
// ----------------------------------------------------------------
export const apiErrorSchema = z.object({
  error: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
