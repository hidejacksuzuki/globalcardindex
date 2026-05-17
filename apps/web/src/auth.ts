/**
 * auth.ts — Auth.js v5 configuration
 *
 * Provider: Resend (email magic link)
 * Adapter:  Prisma (@auth/prisma-adapter)
 *
 * Environment variables required:
 *   AUTH_SECRET          — random 32+ char string (openssl rand -base64 32)
 *   AUTH_RESEND_KEY      — Resend API key (reuses RESEND_API_KEY if not set)
 *   RESEND_FROM_EMAIL    — sender address
 *   DATABASE_URL         — PostgreSQL connection string
 *   NEXT_PUBLIC_BASE_URL — e.g. https://globalcardindex.com
 */

import NextAuth                from "next-auth";
import Resend                  from "next-auth/providers/resend";
import { PrismaAdapter }       from "@auth/prisma-adapter";
import { prisma }              from "@gci/db";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  // ── Providers ─────────────────────────────────────────────────────
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY,
      from:   process.env.RESEND_FROM_EMAIL ?? "GCI <noreply@globalcardindex.com>",
      // カスタム送信関数で件名・本文を完全制御
      sendVerificationRequest: async ({ identifier: email, url }) => {
        const { sendMagicLinkEmail } = await import("@gci/email");
        await sendMagicLinkEmail({ to: email, magicUrl: url });
      },
    }),
  ],

  // ── Session strategy ──────────────────────────────────────────────
  // Database sessions — stored in Session table, more secure than JWT
  session: { strategy: "database" },

  // ── Pages ─────────────────────────────────────────────────────────
  pages: {
    signIn:  "/login",
    signOut: "/login",
    error:   "/login",           // ?error= param on /login
    verifyRequest: "/login/verify",  // "check your email" page
  },

  // ── Callbacks ─────────────────────────────────────────────────────
  callbacks: {
    // Expose user ID and email in session for server components
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },

  // ── Events ────────────────────────────────────────────────────────
  events: {
    // Create default NotificationPrefs on first sign-in
    async createUser({ user }) {
      if (!user.id) return;
      await prisma.notificationPrefs.upsert({
        where:  { userId: user.id },
        create: { userId: user.id, marketAlerts: true, weeklyRecap: true, newsletter: false },
        update: {},
      }).catch(() => undefined);  // non-blocking; prefs will be created lazily if this fails
    },
  },

  // ── Secret ────────────────────────────────────────────────────────
  secret: process.env.AUTH_SECRET,

  // ── Trust proxy (Vercel) ─────────────────────────────────────────
  trustHost: true,
});

// Augment session type to include user.id
declare module "next-auth" {
  interface Session {
    user: {
      id:    string;
      name:  string | null;
      email: string;
      image: string | null;
    };
  }
}
