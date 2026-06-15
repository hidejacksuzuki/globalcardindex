import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@gci/db";
import { listCards } from "@gci/core";
import {
  listCardsQuerySchema,
  createCardBodySchema,
  patchCardBodySchema,
  type CardListResponse,
  type CardDetailResponse,
  type ApiError,
} from "@/lib/api/schemas";

export const cardsRoute = new Hono()

  // ----------------------------------------------------------------
  // GET /api/cards
  // action の listCards() に委譲 → page / API で同一ロジック保証
  // ----------------------------------------------------------------
  .get(
    "/",
    zValidator("query", listCardsQuerySchema),
    async (c): Promise<Response> => {
      const { q, sort, order, page, limit } = c.req.valid("query");

      const result = await listCards({
        search:   q,
        sort,
        order,
        page,
        pageSize: limit,
      });

      const res: CardListResponse = {
        data: result.cards.map((card) => ({
          ...card,
          // CardSummaryWithPrice → CardSummary (schema) の price フィールドに変換
          prices: card.latestPrice !== null
            ? [{ price: card.latestPrice, currency: card.currency!, observedAt: new Date(card.lastObservedAt!) }]
            : [],
        })),
        meta: {
          totalCount: result.totalCount,
          page:       result.page,
          pageSize:   result.pageSize,
          totalPages: result.totalPages,
        },
      };

      return c.json(res);
    }
  )

  // ----------------------------------------------------------------
  // GET /api/cards/:id
  // ----------------------------------------------------------------
  .get("/:id", async (c): Promise<Response> => {
    const id = c.req.param("id");

    const card = await prisma.card.findUnique({
      where: { id },
      include: { prices: { orderBy: { observedAt: "desc" }, take: 200 } },
    });

    if (!card || !card.isVisible || card.deletedAt) {
      return c.json({ error: "Card not found" } satisfies ApiError, 404);
    }

    return c.json({ data: card } satisfies CardDetailResponse);
  })

  // ----------------------------------------------------------------
  // POST /api/cards
  // ----------------------------------------------------------------
  .post(
    "/",
    zValidator("json", createCardBodySchema),
    async (c): Promise<Response> => {
      const body = c.req.valid("json");

      const card = await prisma.card.upsert({
        where: {
          name_setName_rarity_condition: {
            name:      body.name,
            setName:   body.setName,
            rarity:    body.rarity,
            condition: body.condition,
          },
        },
        create: body,
        update: {},
        include: { prices: { take: 0 } },
      });

      return c.json({ data: card } satisfies CardDetailResponse, 201);
    }
  )

  // ----------------------------------------------------------------
  // PATCH /api/cards/:id
  // ----------------------------------------------------------------
  .patch(
    "/:id",
    zValidator("json", patchCardBodySchema),
    async (c): Promise<Response> => {
      const id   = c.req.param("id");
      const body = c.req.valid("json");

      try {
        const card = await prisma.card.update({
          where: { id },
          data: body,
          include: { prices: { orderBy: { observedAt: "desc" }, take: 200 } },
        });
        return c.json({ data: card } satisfies CardDetailResponse);
      } catch {
        return c.json({ error: "Card not found" } satisfies ApiError, 404);
      }
    }
  );
