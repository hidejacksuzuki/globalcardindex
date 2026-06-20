import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/auth";
import { updatePortfolio, removeFromPortfolio } from "@gci/core";

export const dynamic = "force-dynamic";

export async function PATCH(
  req:     NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as { quantity?: number; avgBuyPrice?: number | null; memo?: string | null };
    const item = await updatePortfolio(userId, params.id, {
      ...(body.quantity    !== undefined ? { quantity:    Math.max(1, Math.floor(body.quantity)) } : {}),
      ...(body.avgBuyPrice !== undefined ? { avgBuyPrice: body.avgBuyPrice } : {}),
      ...(body.memo        !== undefined ? { memo:        body.memo }        : {}),
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error("[portfolio PATCH]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req:    NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    await removeFromPortfolio(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[portfolio DELETE]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
