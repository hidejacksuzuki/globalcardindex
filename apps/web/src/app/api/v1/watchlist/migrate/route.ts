/**
 * POST /api/v1/watchlist/migrate
 *
 * Migrates the caller's anonymous cookie-based watchlist (identified by
 * sessionId) into their authenticated UserWatchlistItem rows.
 *
 * Requires an active Auth.js session.
 * Body: { sessionId: string }
 * Response: { migrated: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/auth";
import { migrateAnonymousWatchlist } from "@gci/core";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sessionId: string | undefined;
  try {
    const body = await req.json() as { sessionId?: unknown };
    sessionId  = typeof body.sessionId === "string" ? body.sessionId : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const migrated = await migrateAnonymousWatchlist(session.user.id, sessionId);
  return NextResponse.json({ migrated });
}
