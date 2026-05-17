import { timingSafeEqual } from "./timingSafeEqual";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Cron エンドポイント共通認証
 *
 * - CRON_SECRET が設定されている場合: Authorization: Bearer <secret> を検証
 * - 未設定かつ開発環境: 通過（ローカル開発用）
 * - 未設定かつ本番環境: 拒否（誤設定を防ぐフェイルセーフ）
 *
 * セキュリティ強化 (Week 14):
 * - タイミング攻撃対策: 定数時間比較 (timingSafeEqual)
 * - 最低シークレット長チェック: 本番では 16 文字以上を要求
 * - Bearer トークン以外のフォーマットは即時拒否
 *
 * 呼び出し側:
 *   const authError = authorizeCron(req);
 *   if (authError) return authError;
 */

const MIN_SECRET_LENGTH = 16;

export function authorizeCron(req: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;

  // 本番で CRON_SECRET が未設定の場合は常に拒否
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return unauthorizedResponse("CRON_SECRET is not configured");
    }
    // 開発環境では素通り
    return null;
  }

  // 本番環境でシークレットが短すぎる場合は拒否（設定ミス検知）
  if (process.env.NODE_ENV === "production" && expected.length < MIN_SECRET_LENGTH) {
    return unauthorizedResponse("CRON_SECRET is too short (minimum 16 characters)");
  }

  const header = req.headers.get("authorization") ?? "";

  // "Bearer " プレフィックス必須
  if (!header.startsWith("Bearer ")) {
    return unauthorizedResponse("missing or malformed Authorization header");
  }

  const provided = header.slice(7).trim();

  if (!provided) {
    return unauthorizedResponse("empty token");
  }

  // 定数時間比較（タイミング攻撃対策）
  if (!timingSafeEqual(provided, expected)) {
    return unauthorizedResponse("invalid token");
  }

  return null;  // 認証成功
}

function unauthorizedResponse(reason: string): NextResponse {
  // reason はサーバーログのみ — クライアントには最小限の情報を返す
  console.warn(`[authorizeCron] rejected: ${reason}`);
  const { NextResponse } = require("next/server") as typeof import("next/server");
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}
