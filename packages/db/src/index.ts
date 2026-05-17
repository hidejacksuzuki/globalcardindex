import { PrismaClient } from "@prisma/client";

// PrismaClient singleton — avoids exhausting connections during Next.js dev
// hot-reloads and keeps a single client per Vercel serverless instance.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export Prisma types so consumers don't need a direct @prisma/client dep
export type {
  Card,
  Price,
  Source,
  IndexValue,
  RecalcLog,
  DailyRecapSnapshot,
  NewsletterSubscriber,
  NewsletterRunLog,
  Watchlist,
  WatchlistItem,
  BackupLog,
  CronLog,
  CollectorRun,
} from "@prisma/client";
export { Prisma } from "@prisma/client";
