import { NextRequest, NextResponse } from "next/server";

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
 * ※ Edge Runtime で動作するため Buffer は使えない。atob() を使用。
 */
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

  const authHeader = req.headers.get("authorization") ?? "";

  if (authHeader.startsWith("Basic ")) {
    try {
      const decoded  = atob(authHeader.slice(6)); // base64 decode
      const colonIdx = decoded.indexOf(":");
      if (colonIdx > 0) {
        const user = decoded.slice(0, colonIdx);
        const pass = decoded.slice(colonIdx + 1);
        if (user === expectedUser && pass === expectedPassword) {
          return NextResponse.next();
        }
      }
    } catch {
      // atob failure → fall through to 401
    }
  }

  // 認証失敗 → ブラウザにダイアログを出させる
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="GCI Admin", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: "/admin/:path*",
};
