import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual }           from "@gci/core";

/**
 * Admin 簡易認証 — HTTP Basic Auth
 *
 * 環境変数:
 *   ADMIN_USER     ログインユーザー名（デフォルト: "admin"）
 *   ADMIN_PASSWORD パスワード（必須。未設定の場合は本番環境でアクセスを拒否）
 *
 * ブラウザは WWW-Authenticate ヘッダーを受け取るとネイティブのダイアログを表示する。
 * ソロ運用の β 版として十分なセキュリティレベル。
 * 将来的には NextAuth / Clerk 等に差し替え可能。
 *
 * セキュリティ強化 (Week 14):
 * - timingSafeEqual でタイミング攻撃対策
 * - ADMIN_PASSWORD 最低長チェック（本番 12 文字以上）
 * - 認証ヘッダー不正形式は即時 401
 *
 * ※ Edge Runtime で動作するため Buffer は使えない。atob() を使用。
 */

const MIN_PASSWORD_LENGTH = 12;

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="GCI Admin", charset="UTF-8"',
    },
  });
}

export function middleware(req: NextRequest) {
  // /admin/* のみ対象
  if (!req.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const expectedPassword = process.env.ADMIN_PASSWORD;
  const expectedUser     = process.env.ADMIN_USER ?? "admin";

  // 本番で ADMIN_PASSWORD 未設定 → フェイルセーフ（拒否）
  if (!expectedPassword) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Admin password not configured", { status: 503 });
    }
    // 開発環境では素通り
    return NextResponse.next();
  }

  // 本番環境でパスワードが短すぎる場合は拒否（設定ミス検知）
  if (process.env.NODE_ENV === "production" && expectedPassword.length < MIN_PASSWORD_LENGTH) {
    console.warn("[middleware] ADMIN_PASSWORD is too short (minimum 12 characters)");
    return new NextResponse("Admin password too short — check server configuration", { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";

  if (!authHeader.startsWith("Basic ")) {
    return unauthorized();
  }

  try {
    const decoded  = atob(authHeader.slice(6));  // base64 decode (Edge-compatible)
    const colonIdx = decoded.indexOf(":");

    if (colonIdx <= 0) {
      return unauthorized();
    }

    const providedUser = decoded.slice(0, colonIdx);
    const providedPass = decoded.slice(colonIdx + 1);

    // 定数時間比較（タイミング攻撃対策）— ユーザー名とパスワードを両方検証
    const userMatch = timingSafeEqual(providedUser, expectedUser);
    const passMatch = timingSafeEqual(providedPass, expectedPassword);

    // 両方が一致した場合のみ通過（ショートサーキットしない）
    if (userMatch && passMatch) {
      return NextResponse.next();
    }
  } catch {
    // atob failure (malformed base64) → fall through to 401
  }

  return unauthorized();
}

export const config = {
  matcher: "/admin/:path*",
};
