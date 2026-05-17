import { Hono } from "hono";
import { handle } from "hono/vercel";
import { cardsRoute }   from "@/lib/api/routes/cards";
import { pricesRoute }  from "@/lib/api/routes/prices";
import { indicesRoute } from "@/lib/api/routes/indices";

export const runtime = "nodejs"; // Supabase / Prisma は Edge 非対応

const app = new Hono().basePath("/api");

// ----------------------------------------------------------------
// ルート登録
// ----------------------------------------------------------------
app.route("/cards",   cardsRoute);
app.route("/prices",  pricesRoute);
app.route("/indices", indicesRoute);

// ----------------------------------------------------------------
// ヘルスチェック
// ----------------------------------------------------------------
app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
);

// ----------------------------------------------------------------
// Next.js の App Router ハンドラとしてエクスポート
// ----------------------------------------------------------------
export const GET    = handle(app);
export const POST   = handle(app);
export const PATCH  = handle(app);
export const DELETE = handle(app);
