import { z } from "zod";
import { paginationSchema } from "./common";

// ----------------------------------------------------------------
// Price（カードに紐づく価格レコード）
// ----------------------------------------------------------------
export const priceRecordSchema = z.object({
  id:         z.string(),
  cardId:     z.string(),
  price:      z.number(),
  currency:   z.string(),
  sourceType: z.string(),
  sourceName: z.string(),
  observedAt: z.coerce.date(),   // DB の Date → JSON string → Date に変換
  trustScore: z.number().int(),
  notes:      z.string().nullable(),
  createdAt:  z.coerce.date(),
});

export type PriceRecord = z.infer<typeof priceRecordSchema>;

// ----------------------------------------------------------------
// Card（一覧用サマリー）
// ----------------------------------------------------------------
export const cardSummarySchema = z.object({
  id:        z.string(),
  name:      z.string(),
  setName:   z.string(),
  rarity:    z.string(),
  condition: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // 一覧では最新価格1件のみ含む
  prices: z.array(
    priceRecordSchema.pick({
      price:      true,
      currency:   true,
      observedAt: true,
    })
  ),
});

export type CardSummary = z.infer<typeof cardSummarySchema>;

// ----------------------------------------------------------------
// Card（詳細：価格履歴付き）
// ----------------------------------------------------------------
export const cardDetailSchema = cardSummarySchema.extend({
  prices: z.array(priceRecordSchema),
});

export type CardDetail = z.infer<typeof cardDetailSchema>;

// ----------------------------------------------------------------
// リクエストスキーマ（GET クエリ）
// ----------------------------------------------------------------
export const CARD_SORT_KEYS   = ["name", "latestPrice"] as const;
export const SORT_ORDER_KEYS  = ["asc",  "desc"]        as const;

export type CardSortKey = typeof CARD_SORT_KEYS[number];
export type SortOrder   = typeof SORT_ORDER_KEYS[number];

export const listCardsQuerySchema = z.object({
  q:     z.string().optional(),
  sort:  z.enum(CARD_SORT_KEYS).default("name"),
  order: z.enum(SORT_ORDER_KEYS).default("asc"),
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListCardsQuery = z.infer<typeof listCardsQuerySchema>;

// ----------------------------------------------------------------
// リクエストスキーマ（POST body）
// ----------------------------------------------------------------
export const createCardBodySchema = z.object({
  name:      z.string().min(1),
  setName:   z.string().min(1),
  rarity:    z.string().min(1),
  condition: z.string().min(1),
});

export const patchCardBodySchema = createCardBodySchema.partial();

export type CreateCardBody = z.infer<typeof createCardBodySchema>;
export type PatchCardBody  = z.infer<typeof patchCardBodySchema>;

// ----------------------------------------------------------------
// レスポンス型（ルートの返り値として使う）
// ----------------------------------------------------------------
export const cardListResponseSchema = z.object({
  data: z.array(cardSummarySchema),
  meta: paginationSchema,
});

export const cardDetailResponseSchema = z.object({
  data: cardDetailSchema,
});

export type CardListResponse   = z.infer<typeof cardListResponseSchema>;
export type CardDetailResponse = z.infer<typeof cardDetailResponseSchema>;
