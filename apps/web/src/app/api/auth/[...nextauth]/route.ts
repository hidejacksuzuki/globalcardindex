/**
 * /api/auth/[...nextauth]
 *
 * Auth.js v5 catch-all route handler.
 * Handles: GET /api/auth/session, POST /api/auth/signin/resend,
 *          GET /api/auth/signout, GET /api/auth/callback/resend, etc.
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
