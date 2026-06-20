import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/auth";
import { getPortfolio, addToPortfolio } from "@gci/core";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const items = await getPortfolio(userId);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[portfolio GET]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as { cardId?: string; quantity?: number; avgBuyPrice?: number | null; memo?: string | null };
    if (!body.cardId) return NextResponse.json({ ok: false, error: "cardId required" }, { status: 400 });

    const quantity = Math.max(1, Math.floor(body.quantity ?? 1));
    const item = await addToPortfolio(userId, {
      cardId:      body.cardId,
      quantity,
      avgBuyPrice: body.avgBuyPrice ?? null,
      memo:        body.memo ?? null,
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error("[portfolio POST]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
