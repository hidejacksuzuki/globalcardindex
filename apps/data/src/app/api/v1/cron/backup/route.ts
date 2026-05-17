/**
 * /api/v1/cron/backup
 *
 * DB 整合性チェック Cron（Vercel Cron → gci-data.com）
 * 毎日 03:00 UTC に実行。
 *
 * 役割:
 *   1. 全テーブルの行数スナップショットを BackupLog に保存
 *   2. 前回比較で行数が急減（>20%）したテーブルを異常検知
 *   3. BACKUP_ALERT_EMAIL が設定されていれば Resend で通知
 *   4. cron ツールに実行ステータスを返す
 *
 * 実際の pg_dump フルバックアップは GitHub Actions (.github/workflows/backup.yml) が担う。
 *
 * クエリ:
 *   dry=1   → DB 書き込みなし・チェックのみ
 *   force=1 → 前回との比較スキップ（初回実行など）
 */

import { NextRequest, NextResponse }   from "next/server";
import { authorizeCron, writeCronLog } from "@gci/core";
import { prisma }                      from "@gci/db";
import { sendEmail }                   from "@gci/email";

// ----------------------------------------------------------------
// テーブル別チェック設定
// ----------------------------------------------------------------

type TableCheck = {
  label:       string;
  getCount:    () => Promise<number>;
  warnDrop:    number;  // 前回比この%以上減ったら警告（0〜1）
  errorDrop:   number;  // 前回比この%以上減ったらエラー
  minExpected: number;  // 最低この行数を期待（0 = チェックなし）
};

const TABLE_CHECKS: TableCheck[] = [
  {
    label:       "Price",
    getCount:    () => prisma.price.count(),
    warnDrop:    0.05,   // 5% 減少で警告
    errorDrop:   0.20,   // 20% 減少でエラー
    minExpected: 0,
  },
  {
    label:       "Card",
    getCount:    () => prisma.card.count(),
    warnDrop:    0.02,
    errorDrop:   0.10,
    minExpected: 0,
  },
  {
    label:       "IndexValue",
    getCount:    () => prisma.indexValue.count(),
    warnDrop:    0.0,    // 減ることはないはず
    errorDrop:   0.01,
    minExpected: 0,
  },
  {
    label:       "DailyRecapSnapshot",
    getCount:    () => prisma.dailyRecapSnapshot.count(),
    warnDrop:    0.0,
    errorDrop:   0.01,
    minExpected: 0,
  },
  {
    label:       "NewsletterSubscriber",
    getCount:    () => prisma.newsletterSubscriber.count(),
    warnDrop:    0.10,
    errorDrop:   0.30,
    minExpected: 0,
  },
  {
    label:       "RecalcLog",
    getCount:    () => prisma.recalcLog.count(),
    warnDrop:    0.0,
    errorDrop:   0.01,
    minExpected: 0,
  },
];

// ----------------------------------------------------------------
// Route Handler
// ----------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authError = authorizeCron(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const isDry   = searchParams.get("dry")   === "1";
  const isForce = searchParams.get("force") === "1";
  const startAt = Date.now();

  try {
    // ── 1. 全テーブル行数を並列取得 ────────────────────────────
    const counts = await Promise.all(
      TABLE_CHECKS.map(async (t) => ({
        label: t.label,
        count: await t.getCount(),
      }))
    );
    const countMap: Record<string, number> = Object.fromEntries(
      counts.map((c) => [c.label, c.count])
    );

    // ── 2. 前回の BackupLog（integrity タイプ）を取得 ──────────
    const prevLog = await prisma.backupLog.findFirst({
      where:   { type: "integrity", status: { not: "error" } },
      orderBy: { createdAt: "desc" },
    });
    const prevCounts = (isForce || !prevLog)
      ? null
      : (prevLog.counts as Record<string, number> | null);

    // ── 3. 異常検知 ────────────────────────────────────────────
    type Anomaly = {
      table:    string;
      prev:     number;
      current:  number;
      drop_pct: number;
      severity: "warn" | "error";
    };
    const anomalies: Anomaly[] = [];

    for (const t of TABLE_CHECKS) {
      const current = countMap[t.label] ?? 0;
      const prev    = prevCounts?.[t.label] ?? null;

      // 最低行数チェック
      if (t.minExpected > 0 && current < t.minExpected) {
        anomalies.push({
          table: t.label, prev: prev ?? 0, current,
          drop_pct: 1, severity: "error",
        });
        continue;
      }

      // 前回比チェック
      if (prev !== null && prev > 0) {
        const drop = (prev - current) / prev;
        if (drop >= t.errorDrop) {
          anomalies.push({ table: t.label, prev, current, drop_pct: drop, severity: "error" });
        } else if (drop >= t.warnDrop) {
          anomalies.push({ table: t.label, prev, current, drop_pct: drop, severity: "warn" });
        }
      }
    }

    const hasError = anomalies.some((a) => a.severity === "error");
    const hasWarn  = anomalies.some((a) => a.severity === "warn");
    const status   = hasError ? "error" : hasWarn ? "warn" : "ok";

    // ── 4. DB へ保存 ───────────────────────────────────────────
    if (!isDry) {
      await prisma.backupLog.create({
        data: {
          type:       "integrity",
          status,
          counts:     countMap,
          anomalies:  anomalies.length > 0 ? anomalies : undefined,
          durationMs: Date.now() - startAt,
          triggeredBy: "cron",
        },
      });
    }

    // ── 5. 異常時はメール通知 ──────────────────────────────────
    const alertEmail = process.env.BACKUP_ALERT_EMAIL;
    if (!isDry && alertEmail && anomalies.length > 0) {
      const lines = anomalies.map((a) =>
        `${a.severity.toUpperCase()} ${a.table}: ${a.prev} → ${a.current} (${(a.drop_pct * 100).toFixed(1)}% drop)`
      );
      await sendEmail({
        to:      alertEmail,
        subject: `[GCI] DB 整合性アラート (${status.toUpperCase()}) — ${new Date().toISOString().slice(0, 10)}`,
        html:    `<pre style="font-family:monospace;">${lines.join("\n")}</pre>`,
        text:    lines.join("\n"),
      });
    }

    // ── 6. レスポンス ──────────────────────────────────────────
    return NextResponse.json({
      ok:         !hasError,
      status,
      mode:       isDry ? "dry" : "live",
      date:       new Date().toISOString().slice(0, 10),
      counts:     countMap,
      anomalies,
      durationMs: Date.now() - startAt,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (!isDry) {
      await prisma.backupLog.create({
        data: {
          type:         "integrity",
          status:       "error",
          errorMessage: message,
          durationMs:   Date.now() - startAt,
          triggeredBy:  "cron",
        },
      }).catch(() => {/* DB が落ちている場合は無視 */});
    }

    console.error("[backup] integrity check failed:", message);
    await writeCronLog("backup", "error", {
      durationMs: Date.now() - startAt, isDry, triggeredBy: "cron", errorMessage: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
