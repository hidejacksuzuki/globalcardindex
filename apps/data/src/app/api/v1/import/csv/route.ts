/**
 * POST /api/v1/import/csv
 *
 * Admin CSV import endpoint.
 * Accepts a multipart/form-data upload with a "file" field containing
 * a GCI-standard CSV file, or a raw text/csv body.
 *
 * Auth: Bearer CRON_SECRET のみ（旧 Referer 判定は撤去、2026-07-06 監査）。
 *
 * Query params:
 *   ?dry=1   — parse and validate only, no DB writes
 *
 * Response: ImportSummary JSON
 *   { totalRows, imported, skipped, duplicate, errors[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { importCsv }                 from "@/lib/collectors/csv";

export const dynamic = "force-dynamic";

// Max upload size: 5 MB
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // ── Auth: must come from admin session (Basic Auth cookie) or CRON_SECRET ──
  // The /admin/* middleware covers browser sessions. For programmatic calls
  // we accept the same CRON_SECRET used by cron endpoints.
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  const isProgrammatic =
    cronSecret &&
    authHeader.startsWith("Bearer ") &&
    authHeader.slice(7).trim() === cronSecret;

  // セキュリティ監査 (2026-07-06): Referer ヘッダーは攻撃者が自由に設定できるため
  // "/admin/" を含むだけで認証を通す旧ロジックを撤去。programmatic (Bearer) のみ許可。
  const isFromAdmin = isProgrammatic || process.env.NODE_ENV !== "production";

  if (!isFromAdmin) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const isDry = new URL(req.url).searchParams.get("dry") === "1";
  const contentType = req.headers.get("content-type") ?? "";

  let csvBuffer: Buffer;

  try {
    if (contentType.includes("multipart/form-data")) {
      // ── multipart upload ──────────────────────────────────────────
      const formData = await req.formData();
      const file     = formData.get("file");

      if (!file || typeof file === "string") {
        return NextResponse.json(
          { ok: false, error: "no file field in form data" },
          { status: 400 },
        );
      }

      const arrayBuffer = await (file as File).arrayBuffer();
      if (arrayBuffer.byteLength > MAX_BYTES) {
        return NextResponse.json(
          { ok: false, error: `file too large (max ${MAX_BYTES / 1024}KB)` },
          { status: 413 },
        );
      }

      csvBuffer = Buffer.from(arrayBuffer);

    } else {
      // ── raw text/csv body ─────────────────────────────────────────
      const text = await req.text();
      if (Buffer.byteLength(text) > MAX_BYTES) {
        return NextResponse.json(
          { ok: false, error: `body too large (max ${MAX_BYTES / 1024}KB)` },
          { status: 413 },
        );
      }
      csvBuffer = Buffer.from(text, "utf-8");
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `failed to read request body: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 400 },
    );
  }

  // ── Run import ────────────────────────────────────────────────────────────
  try {
    const summary = await importCsv(csvBuffer, { dryRun: isDry });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[import/csv] import failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "import failed" },
      { status: 500 },
    );
  }
}
