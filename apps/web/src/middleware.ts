/**
 * middleware.ts — Auth.js v5 session middleware
 *
 * Protected routes: /account, /watchlist (redirects to /login if not authenticated)
 * Public routes: everything else
 */

import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Protected paths — require authentication
  const PROTECTED = ["/account"];

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isLoggedIn  = !!req.auth;

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  // Run only on routes that need session checking.
  // The broad second pattern was removed: it caused a DB session lookup
  // on every public route (cards, sets, games, etc.) with no benefit.
  matcher: ["/account/:path*"],
};
