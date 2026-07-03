import { NextRequest, NextResponse } from "next/server";
import { updateBetaFeedbackStatus }  from "@gci/core";

export const dynamic = "force-dynamic";

export async function PATCH(
  req:        NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json() as { status?: string };
    if (!body.status) return NextResponse.json({ ok: false, error: "status required" }, { status: 400 });

    const result = await updateBetaFeedbackStatus(params.id, body.status);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[admin feedback PATCH]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
