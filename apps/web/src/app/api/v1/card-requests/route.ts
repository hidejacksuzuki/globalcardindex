/**
 * POST /api/v1/card-requests
 *
 * Public endpoint — any visitor can submit a card addition request.
 * No auth required; rate-limited at the platform level.
 *
 * Body (JSON):
 *   { name: string, setName?: string, game?: string, rarity?: string,
 *     requestedBy?: string, note?: string }
 *
 * Response:
 *   { ok: true, id: string }
 *   { ok: false, error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ ok: false, error: "body must be an object" }, { status: 400 });
  }

  const {
    name, setName, game, rarity, requestedBy, note,
  } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  }
  if (name.trim().length > 120) {
    return NextResponse.json({ ok: false, error: "name too long" }, { status: 400 });
  }

  try {
    const request = await prisma.cardRequest.create({
      data: {
        name:        name.trim(),
        setName:     typeof setName     === "string" ? setName.trim()     || null : null,
        game:        typeof game        === "string" ? game.trim()        || null : null,
        rarity:      typeof rarity      === "string" ? rarity.trim()      || null : null,
        requestedBy: typeof requestedBy === "string" ? requestedBy.trim() || null : null,
        note:        typeof note        === "string" ? note.trim()        || null : null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: request.id }, { status: 201 });
  } catch (err) {
    console.error("[card-requests] create failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}
