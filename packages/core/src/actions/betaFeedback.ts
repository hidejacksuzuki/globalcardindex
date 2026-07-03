"use server";

import { prisma } from "@gci/db";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type BetaFeedbackType   = "bug" | "request_card" | "feature_request" | "other";
export type BetaFeedbackStatus = "open" | "reviewed" | "closed";

const VALID_TYPES: BetaFeedbackType[] = ["bug", "request_card", "feature_request", "other"];
const VALID_STATUSES: BetaFeedbackStatus[] = ["open", "reviewed", "closed"];

function isValidFeedbackType(v: string): v is BetaFeedbackType {
  return (VALID_TYPES as string[]).includes(v);
}

function isValidFeedbackStatus(v: string): v is BetaFeedbackStatus {
  return (VALID_STATUSES as string[]).includes(v);
}

export type BetaFeedbackEntry = {
  id:          string;
  userId:      string | null;
  type:        BetaFeedbackType;
  message:     string;
  cardName:    string | null;
  currentPath: string | null;
  status:      BetaFeedbackStatus;
  createdAt:   string; // ISO
};

// ----------------------------------------------------------------
// Submit — public (未ログインでも送信可能)
// ----------------------------------------------------------------

export async function submitBetaFeedback(data: {
  userId?:      string | null;
  type:         string;
  message:      string;
  cardName?:    string | null;
  currentPath?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const message = data.message.trim();
  if (!message) return { ok: false, error: "message required" };
  if (message.length > 2000) return { ok: false, error: "message too long" };
  if (!isValidFeedbackType(data.type)) return { ok: false, error: "invalid type" };

  const created = await prisma.betaFeedback.create({
    data: {
      userId:      data.userId ?? null,
      type:        data.type,
      message,
      cardName:    data.cardName?.trim().slice(0, 200) || null,
      currentPath: data.currentPath?.trim().slice(0, 300) || null,
    },
  });

  return { ok: true, id: created.id };
}

// ----------------------------------------------------------------
// Admin queries
// ----------------------------------------------------------------

export type BetaFeedbackFilter = {
  type?:   BetaFeedbackType;
  status?: BetaFeedbackStatus;
  search?: string;
};

export async function getBetaFeedbackList(filter: BetaFeedbackFilter = {}): Promise<BetaFeedbackEntry[]> {
  const { type, status, search } = filter;

  const rows = await prisma.betaFeedback.findMany({
    where: {
      ...(type   ? { type }   : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { message:  { contains: search, mode: "insensitive" } },
          { cardName: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take:    500,
  });

  return rows.map((r) => ({
    id:          r.id,
    userId:      r.userId,
    type:        r.type as BetaFeedbackType,
    message:     r.message,
    cardName:    r.cardName,
    currentPath: r.currentPath,
    status:      r.status as BetaFeedbackStatus,
    createdAt:   r.createdAt.toISOString(),
  }));
}

export async function updateBetaFeedbackStatus(
  id:     string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidFeedbackStatus(status)) return { ok: false, error: "invalid status" };
  await prisma.betaFeedback.update({ where: { id }, data: { status } });
  return { ok: true };
}
