import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/auth";
import { submitBetaFeedback }        from "@gci/core";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const userId  = session?.user?.id ?? null;

    const body = await req.json() as {
      type?:        string;
      message?:     string;
      cardName?:    string | null;
      currentPath?: string | null;
    };

    if (!body.type || !body.message) {
      return NextResponse.json({ ok: false, error: "type and message required" }, { status: 400 });
    }

    const result = await submitBetaFeedback({
      userId,
      type:        body.type,
      message:     body.message,
      cardName:    body.cardName ?? null,
      currentPath: body.currentPath ?? null,
    });

    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[feedback POST]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
