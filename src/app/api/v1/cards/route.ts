import { NextRequest, NextResponse } from "next/server";
import { listCards } from "@/actions/cards";
import type {
  ApiResponse,
  CardSummary,
  Pagination,
} from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

type CardsResponseData = {
  cards: CardSummary[];
  pagination: Pagination;
};

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<CardsResponseData>>> {
  try {
    const sp = req.nextUrl.searchParams;

    // Accept both `q` (preferred) and `search` (legacy) for the query.
    const search = (sp.get("q") ?? sp.get("search") ?? "").trim() || undefined;

    const page = Math.max(1, parsePositiveInt(sp.get("page"), 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parsePositiveInt(sp.get("pageSize"), DEFAULT_PAGE_SIZE)),
    );

    const result = await listCards({ search, page, pageSize });

    return NextResponse.json({
      ok: true,
      data: {
        cards: result.cards,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
        },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
