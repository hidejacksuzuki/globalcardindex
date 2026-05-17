import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@gci/db";
import {
  listPricesQuerySchema,
  createPriceBodySchema,
  bulkPricesBodySchema,
  type BulkPricesBody,
  type PriceListResponse,
  type PriceDetailResponse,
  type BulkCreateResponse,
  type ApiError,
} from "@/lib/api/schemas";

export const pricesRoute = new Hono()

  // ----------------------------------------------------------------
  // GET /api/prices?cardId=xxx
  // 価格履歴一覧（cardId 必須、期間・ソースでフィルタ可）
  // ----------------------------------------------------------------
  .get(
    "/",
    zValidator("query", listPricesQuerySchema),
    async (c): Promise<Response> => {
      const { cardId, from, to, sourceType, sourceName, page, limit } =
        c.req.valid("query");
      const skip = (page - 1) * limit;

      const where = {
        cardId,
        ...(sourceType && { sourceType }),
        ...(sourceName && { sourceName }),
        ...((from || to) && {
          observedAt: {
            ...(from && { gte: new Date(from) }),
            ...(to   && { lte: new Date(to) }),
          },
        }),
      };

      const [prices, total] = await Promise.all([
        prisma.price.findMany({
          where,
          orderBy: { observedAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.price.count({ where }),
      ]);

      const res: PriceListResponse = {
        data: prices,
        meta: {
          totalCount: total,
          page,
          pageSize:   limit,
          totalPages: Math.ceil(total / limit),
        },
      };

      return c.json(res);
    }
  )

  // ----------------------------------------------------------------
  // GET /api/prices/latest?cardId=xxx
  // 最新価格1件
  // ----------------------------------------------------------------
  .get(
    "/latest",
    zValidator("query", listPricesQuerySchema.pick({ cardId: true })),
    async (c): Promise<Response> => {
      const { cardId } = c.req.valid("query");

      const price = await prisma.price.findFirst({
        where: { cardId },
        orderBy: { observedAt: "desc" },
      });

      if (!price) {
        return c.json({ error: "No price data found" } satisfies ApiError, 404);
      }

      return c.json({ data: price } satisfies PriceDetailResponse);
    }
  )

  // ----------------------------------------------------------------
  // POST /api/prices
  // 価格1件登録（手動入力）
  // ----------------------------------------------------------------
  .post(
    "/",
    zValidator("json", createPriceBodySchema),
    async (c): Promise<Response> => {
      const body = c.req.valid("json");

      const card = await prisma.card.findUnique({ where: { id: body.cardId } });
      if (!card) {
        return c.json({ error: "Card not found" } satisfies ApiError, 404);
      }

      const price = await prisma.price.create({
        data: {
          ...body,
          observedAt: body.observedAt ? new Date(body.observedAt) : new Date(),
        },
      });

      return c.json({ data: price } satisfies PriceDetailResponse, 201);
    }
  )

  // ----------------------------------------------------------------
  // POST /api/prices/bulk
  // 価格一括登録（CSV インポート / Python worker 向け）
  // ----------------------------------------------------------------
  .post(
    "/bulk",
    zValidator("json", bulkPricesBodySchema),
    async (c): Promise<Response> => {
      const { prices }: BulkPricesBody = c.req.valid("json");

      const result = await prisma.price.createMany({
        data: prices.map((p: BulkPricesBody["prices"][number]) => ({
          ...p,
          observedAt: p.observedAt ? new Date(p.observedAt) : new Date(),
        })),
      });

      return c.json(
        { data: { count: result.count } } satisfies BulkCreateResponse,
        201,
      );
    }
  );
