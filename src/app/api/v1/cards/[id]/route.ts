import { NextResponse } from "next/server";
import { getCard } from "@/actions/cards";
import type { ApiResponse, CardWithPrices } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse<ApiResponse<CardWithPrices>>> {
  try {
    const data = await getCard(params.id);
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
