import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@gci/db";
import { recalcIndex } from "@gci/core";
import {
  listIndexQuerySchema,
  chartQuerySchema,
  type IndexListResponse,
  type IndexLatestResponse,
  type IndexChartResponse,
  type IndexCalculateResponse,
  type ApiError,
} from "@/lib/api/schemas";

export const indicesRoute = new Hono()

  // ----------------------------------------------------------------
  // GET /api/indices
  // インデックス履歴一覧（新しい順）
  // ----------------------------------------------------------------
  .get(
    "/",
    zValidator("query", listIndexQuerySchema),
    async (c): Promise<Response> => {
      const { limit } = c.req.valid("query");

      const rows = await prisma.indexValue.findMany({
        where:   { cardId: null },
        orderBy: { calculatedAt: "desc" },
        take: limit,
      });

      return c.json({ data: rows } satisfies IndexListResponse);
    }
  )

  // ----------------------------------------------------------------
  // GET /api/indices/latest
  // 最新インデックス値1件
  // ----------------------------------------------------------------
  .get("/latest", async (c): Promise<Response> => {
    const latest = await prisma.indexValue.findFirst({
      where:   { cardId: null },
      orderBy: { calculatedAt: "desc" },
    });

    if (!latest) {
      return c.json({ error: "No index data yet" } satisfies ApiError, 404);
    }

    return c.json({ data: latest } satisfies IndexLatestResponse);
  })

  // ----------------------------------------------------------------
  // GET /api/indices/chart
  // チャート用：指定期間のスナップショット（古い順）
  // ----------------------------------------------------------------
  .get(
    "/chart",
    zValidator("query", chartQuerySchema),
    async (c): Promise<Response> => {
      const { days, limit } = c.req.valid("query");
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const rows = await prisma.indexValue.findMany({
        where:   { cardId: null, calculatedAt: { gte: since } },
        orderBy: { calculatedAt: "asc" },
        take: limit,
        select: { value: true, changeRate: true, calculatedAt: true },
      });

      return c.json({ data: rows } satisfies IndexChartResponse);
    }
  )

  // ----------------------------------------------------------------
  // POST /api/indices/calculate
  // インデックス値を再計算して保存
  // ----------------------------------------------------------------
  .post("/calculate", async (c): Promise<Response> => {
    const result = await recalcIndex();

    if (!result.saved) {
      return c.json({ error: result.reason } satisfies ApiError, 422);
    }

    return c.json({ data: result } satisfies IndexCalculateResponse, 201);
  });
