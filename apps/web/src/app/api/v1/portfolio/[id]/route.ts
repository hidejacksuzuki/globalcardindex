import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/auth";
import { updatePortfolio, removeFromPortfolio } from "@gci/core";

export const dynamic = "force-dynamic";

// Prisma P2025 = 対象レコードなし（別タブで削除済み等）。500 ではなく 404 で返す。
function isNotFound(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025";
}
const NOT_FOUND_MSG = "対象が見つかりません（別の画面で削除された可能性があります）。ページを再読み込みしてください";

export async function PATCH(
  req:     NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as { quantity?: number; avgBuyPrice?: number | null; memo?: string | null; grade?: string | null };
    const VALID_GRADES = ["RAW", "PSA10", "PSA_OTHER", "OTHER_GRADED"] as const;
    const grade = body.grade !== undefined
      ? (VALID_GRADES.includes(body.grade as typeof VALID_GRADES[number])
          ? (body.grade as typeof VALID_GRADES[number])
          : "RAW")
      : undefined;
    const item = await updatePortfolio(userId, params.id, {
      ...(body.quantity    !== undefined ? { quantity:    Math.max(1, Math.floor(body.quantity)) } : {}),
      ...(body.avgBuyPrice !== undefined ? { avgBuyPrice: body.avgBuyPrice } : {}),
      ...(body.memo        !== undefined ? { memo:        body.memo }        : {}),
      ...(grade            !== undefined ? { grade }                          : {}),
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    if (isNotFound(e)) {
      return NextResponse.json({ ok: false, error: NOT_FOUND_MSG }, { status: 404 });
    }
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
    if (isNotFound(e)) {
      // 既に削除済み → 目的は達成されているので成功として返す（冪等）
      return NextResponse.json({ ok: true, alreadyDeleted: true });
    }
    console.error("[portfolio DELETE]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
