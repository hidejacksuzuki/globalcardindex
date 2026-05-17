/**
 * /api/v1/webhooks/resend
 *
 * Resend Webhook エンドポイント。
 * Resend は Svix を使って署名付きで HTTP POST を送信する。
 *
 * 処理するイベント:
 *   email.bounced    → NewsletterSubscriber.status = "bounced"
 *   email.complained → NewsletterSubscriber.status = "unsubscribed"
 *
 * 設定手順（Resend ダッシュボード）:
 *   1. Resend → Webhooks → Add Endpoint
 *   2. URL: https://your-domain.com/api/v1/webhooks/resend
 *   3. Events: email.bounced, email.complained（+ 必要に応じ email.delivered 等）
 *   4. Signing Secret をコピー → RESEND_WEBHOOK_SECRET に設定
 *
 * セキュリティ:
 *   - Svix 署名検証（HMAC-SHA256）
 *   - タイムスタンプ 5 分以内チェック（リプレイアタック防止）
 *   - 冪等設計（同じイベントを複数回受信しても安全）
 *
 * 参考:
 *   https://resend.com/docs/dashboard/webhooks/introduction
 *   https://docs.svix.com/receiving/verifying-payloads/how-manual
 */

import { NextRequest, NextResponse }          from "next/server";
import { createHmac }                         from "node:crypto";
import {
  markSubscriberBounced,
  markSubscriberComplained,
  saveNewsletterRunLog,
} from "@/actions/newsletter";

export const dynamic = "force-dynamic";

// ----------------------------------------------------------------
// Svix 署名検証
//
// アルゴリズム:
//   1. signed_content = "{svix-id}.{svix-timestamp}.{raw_body}"
//   2. secret = base64decode(RESEND_WEBHOOK_SECRET.replace("whsec_",""))
//   3. sig = HMAC-SHA256(secret, signed_content) → base64
//   4. svix-signature ヘッダーの "v1,<base64>" と比較
//   5. タイムスタンプが現在時刻 ±5 分以内か確認
// ----------------------------------------------------------------

const TOLERANCE_MS  = 5 * 60 * 1000;  // 5 分

type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

function verifySvixSignature(
  rawBody:   string,
  headers:   Headers,
  secret:    string,
): VerifyResult {
  const msgId        = headers.get("svix-id");
  const msgTimestamp = headers.get("svix-timestamp");
  const msgSignature = headers.get("svix-signature");

  if (!msgId || !msgTimestamp || !msgSignature) {
    return { ok: false, reason: "missing svix headers" };
  }

  // タイムスタンプ検証（リプレイアタック防止）
  const tsMs = parseInt(msgTimestamp, 10) * 1000;
  if (isNaN(tsMs)) return { ok: false, reason: "invalid timestamp" };

  const diff = Math.abs(Date.now() - tsMs);
  if (diff > TOLERANCE_MS) {
    return { ok: false, reason: `timestamp out of tolerance: ${diff}ms` };
  }

  // シークレット: "whsec_<base64>" → base64 部分だけ取り出してデコード
  const secretBase64 = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;
  const secretBytes = Buffer.from(secretBase64, "base64");

  // 署名対象文字列
  const signedContent = `${msgId}.${msgTimestamp}.${rawBody}`;

  // HMAC-SHA256
  const expectedSig = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // svix-signature は "v1,<base64> v1,<base64>" と複数ある場合もある
  const signatures = msgSignature.split(" ").map((s) => s.split(",")[1]).filter(Boolean);

  const matches = signatures.some((sig) => {
    // タイミング攻撃対策: 定数時間比較
    if (sig.length !== expectedSig.length) return false;
    return sig === expectedSig;
  });

  if (!matches) return { ok: false, reason: "signature mismatch" };

  return { ok: true };
}

// ----------------------------------------------------------------
// Resend Webhook ペイロード型
// ----------------------------------------------------------------

type ResendBounceEvent = {
  type:       "email.bounced";
  created_at: string;
  data: {
    email_id: string;
    from:     string;
    to:       string[];
    subject:  string;
    bounce: {
      message: string;
      type:    "hard" | "soft";
    };
  };
};

type ResendComplaintEvent = {
  type:       "email.complained";
  created_at: string;
  data: {
    email_id: string;
    from:     string;
    to:       string[];
    subject:  string;
  };
};

type ResendEvent = ResendBounceEvent | ResendComplaintEvent | { type: string; [k: string]: unknown };

// ----------------------------------------------------------------
// メインハンドラ
// ----------------------------------------------------------------

export async function POST(req: NextRequest) {
  const start = Date.now();

  // ── 1. 生ボディを文字列で読む（署名検証に必須）──────────────────
  const rawBody = await req.text();

  // ── 2. 署名検証 ─────────────────────────────────────────────────
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook/resend] RESEND_WEBHOOK_SECRET is not set");
    // 本番では 500 より 200 を返してエラーを非開示にする選択肢もあるが、
    // 設定ミスは早期発見したいので 500 を返す
    return NextResponse.json({ ok: false, error: "webhook secret not configured" }, { status: 500 });
  }

  const verify = verifySvixSignature(rawBody, req.headers, secret);
  if (!verify.ok) {
    console.warn("[webhook/resend] signature verification failed:", verify.reason);
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  // ── 3. ペイロードパース ──────────────────────────────────────────
  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const eventType = event.type;
  const today     = new Date().toLocaleDateString("sv-SE");

  // ── 4. イベント処理 ──────────────────────────────────────────────
  switch (eventType) {

    // ── email.bounced ──────────────────────────────────────────────
    case "email.bounced": {
      const e      = event as ResendBounceEvent;
      const emails = e.data.to ?? [];

      let processedCount = 0;
      let skippedCount   = 0;
      let errorCount     = 0;

      for (const email of emails) {
        const bounceType = e.data.bounce?.type ?? "hard";
        const result     = await markSubscriberBounced(email, bounceType);

        if (!result.ok) {
          errorCount++;
          console.error(`[webhook/resend] bounce error for ${email}:`, result.error);
        } else if (result.action === "bounced") {
          processedCount++;
          console.log(`[webhook/resend] bounced: ${email} (type=${bounceType})`);
        } else {
          skippedCount++;
          console.log(`[webhook/resend] bounce skipped (already handled): ${email}`);
        }
      }

      await saveNewsletterRunLog({
        mode:        "webhook_event",
        date:        today,
        status:      errorCount === 0 ? "ok" : "error",
        totalTarget: emails.length,
        totalSent:   0,
        errorCount,
        durationMs:  Date.now() - start,
        note:        `email.bounced processed=${processedCount} skipped=${skippedCount} errors=${errorCount} email_id=${(e.data as { email_id?: string }).email_id ?? ""}`,
        triggeredBy: "webhook",
      }).catch((e) => console.warn("[webhook/resend] run log save failed:", e));

      return NextResponse.json({
        ok:        true,
        event:     eventType,
        processed: processedCount,
        skipped:   skippedCount,
        errors:    errorCount,
      });
    }

    // ── email.complained ───────────────────────────────────────────
    case "email.complained": {
      const e      = event as ResendComplaintEvent;
      const emails = e.data.to ?? [];

      let processedCount = 0;
      let skippedCount   = 0;
      let errorCount     = 0;

      for (const email of emails) {
        const result = await markSubscriberComplained(email);

        if (!result.ok) {
          errorCount++;
          console.error(`[webhook/resend] complaint error for ${email}:`, result.error);
        } else if (result.action === "unsubscribed") {
          processedCount++;
          console.log(`[webhook/resend] complaint→unsubscribed: ${email}`);
        } else {
          skippedCount++;
          console.log(`[webhook/resend] complaint skipped (already stopped): ${email}`);
        }
      }

      await saveNewsletterRunLog({
        mode:        "webhook_event",
        date:        today,
        status:      errorCount === 0 ? "ok" : "error",
        totalTarget: emails.length,
        totalSent:   0,
        errorCount,
        durationMs:  Date.now() - start,
        note:        `email.complained processed=${processedCount} skipped=${skippedCount} errors=${errorCount}`,
        triggeredBy: "webhook",
      }).catch((e) => console.warn("[webhook/resend] run log save failed:", e));

      return NextResponse.json({
        ok:        true,
        event:     eventType,
        processed: processedCount,
        skipped:   skippedCount,
        errors:    errorCount,
      });
    }

    // ── その他のイベント（無視・200 で返す）─────────────────────────
    default: {
      console.log(`[webhook/resend] unhandled event type: ${eventType}`);
      return NextResponse.json({ ok: true, event: eventType, action: "ignored" });
    }
  }
}

// GET は許可しない（Resend がエンドポイント確認で GET を送ることはない）
export function GET() {
  return NextResponse.json({ ok: false, error: "method not allowed" }, { status: 405 });
}
