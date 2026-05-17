/**
 * PATCH /api/v1/account/prefs
 *
 * Updates the authenticated user's NotificationPrefs.
 * Called by NotifPrefsForm whenever a toggle is changed.
 *
 * Body (partial — only the key being toggled is sent):
 *   { marketAlerts?: boolean; weeklyRecap?: boolean; newsletter?: boolean }
 *
 * Requires a valid Auth.js session.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/auth";
import { prisma }                    from "@gci/db";

type PrefsBody = {
  marketAlerts?: boolean;
  weeklyRecap?:  boolean;
  newsletter?:   boolean;
};

const ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "marketAlerts",
  "weeklyRecap",
  "newsletter",
]);

export async function PATCH(req: NextRequest) {
  // Auth guard
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Parse + validate body
  let body: PrefsBody;
  try {
    body = await req.json() as PrefsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Strip any keys not in the allowed set and validate values are booleans
  const update: PrefsBody = {};
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (typeof value !== "boolean") {
      return NextResponse.json(
        { error: `Invalid value for "${key}": must be boolean` },
        { status: 400 },
      );
    }
    (update as Record<string, boolean>)[key] = value;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No valid fields provided" },
      { status: 400 },
    );
  }

  // Upsert — create the row if it doesn't exist yet
  const prefs = await prisma.notificationPrefs.upsert({
    where:  { userId },
    create: {
      userId,
      marketAlerts: update.marketAlerts ?? true,
      weeklyRecap:  update.weeklyRecap  ?? true,
      newsletter:   update.newsletter   ?? false,
    },
    update: {
      ...update,
      // updatedAt is managed automatically by Prisma @updatedAt
    },
    select: {
      marketAlerts: true,
      weeklyRecap:  true,
      newsletter:   true,
      updatedAt:    true,
    },
  });

  return NextResponse.json({ ok: true, prefs });
}
