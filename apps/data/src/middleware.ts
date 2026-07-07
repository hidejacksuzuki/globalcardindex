import { NextRequest, NextResponse } from "next/server";

/** Edge Runtime 互換のタイミングセーフ文字列比較 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // 長さが違っても全文字比較してタイミング情報を漏らさない
    let diff = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      diff |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

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

/**
 * Basic Auth 保護が必要な管理系 API パスの接頭辞。
 *
 * セキュリティ監査 (2026-07-06) で発覚: これらのルートは各ファイルが個別に
 * `Referer` ヘッダーの中身（攻撃者が自由に設定できる）を admin 判定に使う
 * `isAuthorized()` を実装しており、実質認証なしで呼び出せた
 * （例: curl -H "Referer: https://x/admin/y" で管理者操作が可能だった）。
 * ミドルウェアで先に弾くことで、ルート側の実装に依存せず一括で防御する。
 *
 * /api/v1/cron/*・/api/v1/webhooks/*・/api/admin/*・/api/v1/import/* はここに含めない:
 *   - cron は Vercel Cron が Bearer $CRON_SECRET を送る想定で Basic Auth を送れない
 *     （authorizeCron() で別途保護されている）
 *   - webhooks は外部サービス（Resend）が呼ぶため Basic Auth を送れない
 *     （svix 署名検証で別途保護されている）
 *   - /api/admin/* と /api/v1/import/* は Chrome 拡張機能（Mercari/eBay/ヤフオク
 *     収集ツール）が Bearer $CRON_SECRET（または X-GCI-Key）でクロスオリジン呼び出し
 *     する設計のため、ここで Basic Auth を要求するとブラウザのネイティブ認証ダイアログが
 *     先に割り込み拡張機能が動作しなくなる。これらは各ルートの isAuthorized() 側で
 *     Referer フォールバックを撤去し Bearer 認証のみに限定する対応を取った
 *     （2026-07-06 監査で /api/v1/import を一旦含めてしまい拡張機能が壊れたため修正）。
 * /api/v1/cards, /api/v1/cards/[id] は意図した公開 API のため対象外。
 */
const PROTECTED_API_PREFIXES = [
  "/api/v1/card-requests",
  "/api/v1/cards/bulk-add",
  "/api/v1/cards/candidates",
  "/api/v1/cards/import-watchlist",
  "/api/v1/cards/quick-add",
  "/api/v1/collector",
  "/api/v1/auction-listings",
  "/api/v1/listings",
  "/api/v1/market-listings",
  "/api/v1/prices",
  "/api/v1/index",
  "/api/v1/debug",
];

export function middleware(req: NextRequest) {
  // /admin/*（画面）・/api/v1/admin/*・上記の管理API群を対象
  const { pathname } = req.nextUrl;
  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/v1/admin") ||
    PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) {
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
  matcher: [
    "/admin/:path*",
    "/api/v1/admin/:path*",
    "/api/v1/card-requests/:path*",
    "/api/v1/cards/bulk-add",
    "/api/v1/cards/candidates/:path*",
    "/api/v1/cards/import-watchlist",
    "/api/v1/cards/quick-add",
    "/api/v1/collector/:path*",
    "/api/v1/auction-listings/:path*",
    "/api/v1/listings/:path*",
    "/api/v1/market-listings/:path*",
    "/api/v1/prices/:path*",
    "/api/v1/index/:path*",
    "/api/v1/debug/:path*",
  ],
};
