import type { NextRequest } from "next/server";

/**
 * Cron エンドポイント共通認証
 *
 * - CRON_SECRET が設定されている場合: Authorization: Bearer <secret> を検証
 * - 未設定かつ開発環境: 通過（ローカル開発用）
 * - 未設定かつ本番環境: 拒否（誤設定を防ぐフェイルセーフ）
 */
export function authorizeCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;

  // 本番で CRON_SECRET が未設定の場合は常に拒否
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }

  const header   = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return provided.length > 0 && provided === expected;
}
