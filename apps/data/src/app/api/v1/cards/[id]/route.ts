/**
 * GET /api/v1/cards/[id]
 *
 * Returns basic card info for the collect page.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const card = await prisma.card.findUnique({
    where:  { id: params.id },
    select: { id: true, name: true, setName: true, rarity: true, game: true },
  });

  if (!card) {
    return NextResponse.json({ ok: false, error: "card not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, card });
}
