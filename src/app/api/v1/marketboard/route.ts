import { NextRequest, NextResponse } from "next/server";
import { getMarketboard } from "@/actions/market";
import {
  MARKET_SORT_KEYS,
  type ApiResponse,
  type MarketboardRow,
  type MarketSortKey,
  type MarketSortOrder,
} from "@/types";

export const dynamic = "force-dynamic";

function parseSort(s: string | null): MarketSortKey | null {
  if (!s) return null;
  return (MARKET_SORT_KEYS as readonly string[]).includes(s)
    ? (s as MarketSortKey)
    : null;
}

function parseOrder(o: string | null): MarketSortOrder {
  return o === "asc" ? "asc" : "desc";
}

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<MarketboardRow[]>>> {
  try {
    const sp = req.nextUrl.searchParams;
    const search = (sp.get("q") ?? sp.get("search") ?? "").trim() || undefined;
    const sort = parseSort(sp.get("sort"));
    const order = parseOrder(sp.get("order"));

    const data = await getMarketboard({ search, sort, order });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
