import { PrismaClient } from "@prisma/client";

// PrismaClient singleton — avoids exhausting connections during Next.js dev
// hot-reloads and keeps a single client per Vercel serverless instance.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * 1インスタンスあたりの DB 接続本数の上限（任意）。
 * 環境変数 PRISMA_CONNECTION_LIMIT がある時だけ DATABASE_URL の
 * connection_limit を上書きする。未設定なら従来どおり（URL のまま）。
 * 2026-11-10 にボットの集中アクセスで Supabase の接続上限（200）に達したため、
 * 閲覧用の gci-web だけこの値を小さくして、インスタンスが増えても上限に届きにくくする。
 */
function resolveDatasourceUrl(): string | undefined {
  const base  = process.env.DATABASE_URL;
  const limit = process.env.PRISMA_CONNECTION_LIMIT;
  if (!base || !limit || !/^[1-9]\d*$/.test(limit)) return undefined;
  try {
    const url = new URL(base);
    url.searchParams.set("connection_limit", limit);
    return url.toString();
  } catch {
    return undefined;
  }
}

const datasourceUrl = resolveDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
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
