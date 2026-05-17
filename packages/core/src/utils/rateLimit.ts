/**
 * packages/core/src/utils/rateLimit.ts
 *
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Design notes:
 * - Keyed by client IP (or any string key).
 * - Uses a Map<key, number[]> where the array holds request timestamps (ms).
 * - On each call, old timestamps outside the window are pruned.
 * - Max map size is capped to avoid unbounded memory growth.
 * - Works in both Node.js and Edge runtimes (no Node-specific APIs).
 *
 * Vercel serverless caveat:
 *   State is per-instance; cold starts reset the counter. This is acceptable —
 *   the limiter guards against burst abuse within a warm instance, not across
 *   the entire fleet. For stricter global limiting, use Vercel KV / Upstash.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 60 });
 *
 *   export async function GET(req: NextRequest) {
 *     const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous";
 *     const result = limiter.check(ip);
 *     if (!result.allowed) {
 *       return new NextResponse("Too Many Requests", {
 *         status: 429,
 *         headers: {
 *           "Retry-After":       String(Math.ceil((result.resetAt - Date.now()) / 1000)),
 *           "X-RateLimit-Limit": String(limiter.max),
 *           "X-RateLimit-Remaining": "0",
 *           "X-RateLimit-Reset":  String(Math.ceil(result.resetAt / 1000)),
 *         },
 *       });
 *     }
 *     // ... handle request
 *   }
 */

const MAX_KEYS = 10_000;  // cap to prevent unbounded memory growth

export interface RateLimitOptions {
  /** Sliding window duration in milliseconds (default: 60_000 = 1 min) */
  windowMs?: number;
  /** Maximum requests allowed in the window (default: 60) */
  max?: number;
}

export interface RateLimitResult {
  allowed:   boolean;
  remaining: number;   // requests left in this window
  resetAt:   number;   // Unix timestamp (ms) when the window resets for this key
  total:     number;   // total hits in current window (including this one)
}

export interface RateLimiter {
  readonly windowMs: number;
  readonly max:      number;
  check(key: string): RateLimitResult;
  reset(key: string): void;
}

export function createRateLimiter(opts: RateLimitOptions = {}): RateLimiter {
  const windowMs = opts.windowMs ?? 60_000;
  const max      = opts.max      ?? 60;

  // Map<key, sorted array of request timestamps>
  const store = new Map<string, number[]>();

  function evictIfFull() {
    if (store.size >= MAX_KEYS) {
      // Evict the 1000 oldest keys (by insertion order)
      let evicted = 0;
      for (const key of store.keys()) {
        store.delete(key);
        if (++evicted >= 1000) break;
      }
    }
  }

  function check(key: string): RateLimitResult {
    const now     = Date.now();
    const cutoff  = now - windowMs;

    let timestamps = store.get(key);

    // Prune old timestamps
    if (timestamps) {
      // Find first index still within window
      let start = 0;
      while (start < timestamps.length && timestamps[start] <= cutoff) start++;
      timestamps = timestamps.slice(start);
    } else {
      timestamps = [];
    }

    const total     = timestamps.length + 1;
    const allowed   = total <= max;
    const resetAt   = timestamps.length > 0 ? timestamps[0] + windowMs : now + windowMs;
    const remaining = Math.max(0, max - total);

    if (allowed) {
      timestamps.push(now);
      evictIfFull();
      store.set(key, timestamps);
    }

    return { allowed, remaining, resetAt, total };
  }

  function reset(key: string): void {
    store.delete(key);
  }

  return { windowMs, max, check, reset };
}

// ── Pre-built limiters for common use cases ─────────────────────────────────

/** 60 req/min per IP — default for public read-only API endpoints */
export const apiLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

/** 10 req/min per IP — stricter limit for expensive endpoints */
export const strictLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

// ── Helper: extract client IP from Next.js request ──────────────────────────

export function getClientIp(headers: Headers): string {
  // Vercel sets x-forwarded-for to the original client IP
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  // Fallback: Vercel-specific real IP header
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "anonymous";
}

// ── Helper: build 429 response ───────────────────────────────────────────────

export function rateLimitResponse(result: RateLimitResult, max: number): Response {
  const retryAfterSec = Math.ceil(Math.max(0, result.resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ ok: false, error: "Too Many Requests", retryAfterSec }),
    {
      status:  429,
      headers: {
        "Content-Type":          "application/json",
        "Retry-After":           String(retryAfterSec),
        "X-RateLimit-Limit":     String(max),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset":     String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}
