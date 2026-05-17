"use server";

/**
 * newsletter.ts
 *
 * ニュースレター購読管理のサーバーアクション。
 *
 * フロー:
 *   1. subscribe(email)         → status: pending + 確認メール送信
 *   2. confirmSubscription(token) → status: active + confirmedAt 記録
 *   3. unsubscribe(token)       → status: unsubscribed + unsubscribedAt 記録
 *                                  + 退会完了メール送信
 *
 * 設計:
 *   - token は cuid()（推測不可能）を共用（confirm + unsubscribe 両方で使う）
 *   - 物理削除しない（退会履歴・consent 証跡として保持）
 *   - 同一メールの再登録: status を pending に戻して再送（token は新規発行）
 */

import { prisma }                                           from "@/lib/prisma";
import { sendEmail, buildConfirmEmail, buildUnsubscribeEmail } from "@/lib/email/resend";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function confirmUrl(token: string): string {
  return `${BASE_URL}/newsletter/confirm/${token}`;
}

function unsubUrl(token: string): string {
  return `${BASE_URL}/newsletter/unsubscribe/${token}`;
}

/** メールアドレスの簡易バリデーション */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim().toLowerCase());
}

// ----------------------------------------------------------------
// 型
// ----------------------------------------------------------------

export type SubscribeResult =
  | { ok: true;  status: "pending" | "already_active" }
  | { ok: false; error: string };

export type ConfirmResult =
  | { ok: true;  email: string }
  | { ok: false; error: "invalid_token" | "already_confirmed" | "unsubscribed" };

export type UnsubscribeResult =
  | { ok: true;  email: string }
  | { ok: false; error: "invalid_token" | "already_unsubscribed" };

// ----------------------------------------------------------------
// subscribe — 新規登録・再登録
// ----------------------------------------------------------------

export async function subscribe(
  formData: FormData | { email: string; source?: string },
): Promise<SubscribeResult> {
  // FormData と plain object の両方を受け付ける
  const raw    = formData instanceof FormData ? formData.get("email") : formData.email;
  const source = formData instanceof FormData
    ? (formData.get("source") as string | null) ?? undefined
    : formData.source;

  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";

  if (!isValidEmail(email)) {
    return { ok: false, error: "メールアドレスの形式が正しくありません。" };
  }

  try {
    // 既存レコード確認
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existing?.status === "active") {
      // 既に購読中 → 静かに成功を返す（email enumeration 防止）
      return { ok: true, status: "already_active" };
    }

    // upsert: 新規 or 退会済みの再登録 or pending の再送
    // token を再生成して確認メールを送り直す
    const subscriber = await prisma.newsletterSubscriber.upsert({
      where:  { email },
      create: { email, status: "pending", source },
      update: {
        status:          "pending",
        token:           crypto.randomUUID().replace(/-/g, ""),  // 再生成
        unsubscribedAt:  null,
        confirmedAt:     null,
        source:          source ?? existing?.source,
        updatedAt:       new Date(),
      },
    });

    // 確認メール送信
    const payload = buildConfirmEmail({
      email,
      confirmUrl: confirmUrl(subscriber.token),
      unsubUrl:   unsubUrl(subscriber.token),
    });

    const result = await sendEmail(payload);
    if (result.error) {
      console.error("[newsletter] confirm email failed:", result.error);
      // メール送信失敗でも DB は保存済み → pending のまま継続
      // ユーザーには「送信済み」と伝え、再試行できるようにしておく
    }

    return { ok: true, status: "pending" };
  } catch (e) {
    console.error("[newsletter] subscribe error:", e);
    return { ok: false, error: "エラーが発生しました。しばらくして再試行してください。" };
  }
}

// ----------------------------------------------------------------
// confirmSubscription — ダブルオプトイン確認
// ----------------------------------------------------------------

export async function confirmSubscription(token: string): Promise<ConfirmResult> {
  if (!token) return { ok: false, error: "invalid_token" };

  try {
    const row = await prisma.newsletterSubscriber.findUnique({
      where: { token },
    });

    if (!row) return { ok: false, error: "invalid_token" };

    if (row.status === "unsubscribed") {
      return { ok: false, error: "unsubscribed" };
    }

    if (row.status === "active" && row.confirmedAt) {
      return { ok: false, error: "already_confirmed" };
    }

    await prisma.newsletterSubscriber.update({
      where: { token },
      data:  { status: "active", confirmedAt: new Date() },
    });

    return { ok: true, email: row.email };
  } catch (e) {
    console.error("[newsletter] confirm error:", e);
    return { ok: false, error: "invalid_token" };
  }
}

// ----------------------------------------------------------------
// unsubscribe — 退会
// ----------------------------------------------------------------

export async function unsubscribe(token: string): Promise<UnsubscribeResult> {
  if (!token) return { ok: false, error: "invalid_token" };

  try {
    const row = await prisma.newsletterSubscriber.findUnique({
      where: { token },
    });

    if (!row) return { ok: false, error: "invalid_token" };

    if (row.status === "unsubscribed") {
      return { ok: false, error: "already_unsubscribed" };
    }

    await prisma.newsletterSubscriber.update({
      where: { token },
      data:  { status: "unsubscribed", unsubscribedAt: new Date() },
    });

    // 退会完了メール（任意。送信失敗しても退会は完了）
    const payload = buildUnsubscribeEmail({ email: row.email });
    await sendEmail(payload).catch((e) =>
      console.warn("[newsletter] unsubscribe confirmation email failed:", e),
    );

    return { ok: true, email: row.email };
  } catch (e) {
    console.error("[newsletter] unsubscribe error:", e);
    return { ok: false, error: "invalid_token" };
  }
}

// ----------------------------------------------------------------
// Admin / Stats
// ----------------------------------------------------------------

export type SubscriberStats = {
  total:        number;
  active:       number;
  pending:      number;
  unsubscribed: number;
  bounced:      number;
};

export async function getSubscriberStats(): Promise<SubscriberStats> {
  const [total, active, pending, unsubscribed, bounced] = await Promise.all([
    prisma.newsletterSubscriber.count(),
    prisma.newsletterSubscriber.count({ where: { status: "active" } }),
    prisma.newsletterSubscriber.count({ where: { status: "pending" } }),
    prisma.newsletterSubscriber.count({ where: { status: "unsubscribed" } }),
    prisma.newsletterSubscriber.count({ where: { status: "bounced" } }),
  ]);
  return { total, active, pending, unsubscribed, bounced };
}

/**
 * 配信対象（active）の購読者一覧。
 * daily-newsletter cron が使用する。
 */
export async function getActiveSubscribers(): Promise<
  { email: string; token: string }[]
> {
  return prisma.newsletterSubscriber.findMany({
    where:  { status: "active" },
    select: { email: true, token: true },
    orderBy: { confirmedAt: "asc" },
  });
}

// ----------------------------------------------------------------
// Admin: 購読者一覧（最新 N 件）
// ----------------------------------------------------------------

export type SubscriberRow = {
  id:             string;
  email:          string;
  status:         string;
  source:         string | null;
  confirmedAt:    string | null;   // ISO
  unsubscribedAt: string | null;   // ISO
  bouncedAt:      string | null;   // ISO
  bounceType:     string | null;
  createdAt:      string;          // ISO
};

export async function getRecentSubscribers(limit = 20): Promise<SubscriberRow[]> {
  const rows = await prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    take:    limit,
    select: {
      id:             true,
      email:          true,
      status:         true,
      source:         true,
      confirmedAt:    true,
      unsubscribedAt: true,
      bouncedAt:      true,
      bounceType:     true,
      createdAt:      true,
    },
  });

  return rows.map((r) => ({
    id:             r.id,
    email:          r.email,
    status:         r.status,
    source:         r.source,
    confirmedAt:    r.confirmedAt?.toISOString()    ?? null,
    unsubscribedAt: r.unsubscribedAt?.toISOString() ?? null,
    bouncedAt:      r.bouncedAt?.toISOString()      ?? null,
    bounceType:     r.bounceType,
    createdAt:      r.createdAt.toISOString(),
  }));
}

// ----------------------------------------------------------------
// Admin: 配信実行ログ（最新 N 件）
// ----------------------------------------------------------------

export type NewsletterRunLogRow = {
  id:          string;
  mode:        string;
  date:        string;
  status:      string;
  totalTarget: number;
  totalSent:   number;
  errorCount:  number;
  durationMs:  number | null;
  note:        string | null;
  triggeredBy: string;
  createdAt:   string;   // ISO
};

export async function getNewsletterRunLogs(
  limit = 10,
): Promise<NewsletterRunLogRow[]> {
  const rows = await prisma.newsletterRunLog.findMany({
    orderBy: { createdAt: "desc" },
    take:    limit,
  });

  return rows.map((r) => ({
    id:          r.id,
    mode:        r.mode,
    date:        r.date,
    status:      r.status,
    totalTarget: r.totalTarget,
    totalSent:   r.totalSent,
    errorCount:  r.errorCount,
    durationMs:  r.durationMs,
    note:        r.note,
    triggeredBy: r.triggeredBy,
    createdAt:   r.createdAt.toISOString(),
  }));
}

/**
 * 実行ログを保存する。daily-newsletter cron / webhook が呼び出す。
 */
export async function saveNewsletterRunLog(
  data: Omit<NewsletterRunLogRow, "id" | "createdAt">,
): Promise<void> {
  await prisma.newsletterRunLog.create({
    data: {
      mode:        data.mode,
      date:        data.date,
      status:      data.status,
      totalTarget: data.totalTarget,
      totalSent:   data.totalSent,
      errorCount:  data.errorCount,
      durationMs:  data.durationMs ?? undefined,
      note:        data.note ?? undefined,
      triggeredBy: data.triggeredBy,
    },
  });
}

// ----------------------------------------------------------------
// Webhook: Bounce / Complaint 処理
//
// 設計: 冪等性優先
//   - bounce: status が既に "bounced" ならスキップ（no-op）
//   - complaint: status が既に "unsubscribed" または "bounced" ならスキップ
//   - 存在しないメール（すでに物理削除、または GCI 以外の送信先）も無視
// ----------------------------------------------------------------

export type BounceResult =
  | { ok: true;  action: "bounced" | "skipped"; email: string }
  | { ok: false; error: string };

/**
 * email.bounced イベント処理。
 * bounceType: "hard" | "soft" （Resend から渡される）
 */
export async function markSubscriberBounced(
  email:      string,
  bounceType: string,
): Promise<BounceResult> {
  if (!email) return { ok: false, error: "email is required" };

  try {
    const row = await prisma.newsletterSubscriber.findUnique({
      where:  { email },
      select: { status: true },
    });

    // 存在しない → GCI 以外の送信先か、既に削除済み → 無視して OK
    if (!row) return { ok: true, action: "skipped", email };

    // 冪等: 既に bounced ならスキップ
    if (row.status === "bounced") {
      return { ok: true, action: "skipped", email };
    }

    await prisma.newsletterSubscriber.update({
      where: { email },
      data:  {
        status:     "bounced",
        bouncedAt:  new Date(),
        bounceType,
        // active / pending → bounced への遷移を明示的に記録
        // confirmedAt は消さない（consent 証跡として保持）
      },
    });

    return { ok: true, action: "bounced", email };
  } catch (e) {
    console.error("[newsletter] markSubscriberBounced error:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type ComplaintResult =
  | { ok: true;  action: "unsubscribed" | "skipped"; email: string }
  | { ok: false; error: string };

/**
 * email.complained イベント処理（スパム報告）。
 * complaint は退会相当として扱う（bounced と区別して unsubscribed に）。
 */
export async function markSubscriberComplained(
  email: string,
): Promise<ComplaintResult> {
  if (!email) return { ok: false, error: "email is required" };

  try {
    const row = await prisma.newsletterSubscriber.findUnique({
      where:  { email },
      select: { status: true },
    });

    if (!row) return { ok: true, action: "skipped", email };

    // 冪等: 既に unsubscribed / bounced なら配信停止済み → スキップ
    if (row.status === "unsubscribed" || row.status === "bounced") {
      return { ok: true, action: "skipped", email };
    }

    await prisma.newsletterSubscriber.update({
      where: { email },
      data:  {
        status:         "unsubscribed",
        unsubscribedAt: new Date(),
        // bounceType は設定しない（complaint は bounce とは別物）
      },
    });

    return { ok: true, action: "unsubscribed", email };
  } catch (e) {
    console.error("[newsletter] markSubscriberComplained error:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
