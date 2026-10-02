import "server-only";
import { RateLimitError } from "./errors";
import { getRedis } from "./redis";

export type RateLimitRule = {
  /** Bucket name, e.g. "ai" */
  name: string;
  /** Max requests per window */
  limit: number;
  windowSeconds: number;
};

/** Predefined budgets. AI routes are the expensive ones, so they get the tightest limits. */
export const RATE_LIMITS = {
  auth: { name: "auth", limit: 10, windowSeconds: 60 },
  read: { name: "read", limit: 300, windowSeconds: 60 },
  write: { name: "write", limit: 60, windowSeconds: 60 },
  ai: { name: "ai", limit: 30, windowSeconds: 60 },
  sync: { name: "sync", limit: 6, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

/** Fixed-window counter. Throws RateLimitError when the caller is over budget. */
export async function enforceRateLimit(rule: RateLimitRule, identity: string): Promise<void> {
  const windowId = Math.floor(Date.now() / 1000 / rule.windowSeconds);
  const key = `rl:${rule.name}:${identity}:${windowId}`;
  const retryAfter = rule.windowSeconds - (Math.floor(Date.now() / 1000) % rule.windowSeconds);

  const redis = getRedis();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, rule.windowSeconds);
      if (count > rule.limit) throw new RateLimitError(retryAfter);
      return;
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      // Redis unavailable: fall through to the in-memory limiter rather than failing open.
    }
  }

  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
    if (memoryBuckets.size > 10_000) {
      for (const [k, v] of memoryBuckets) if (v.resetAt < now) memoryBuckets.delete(k);
    }
    return;
  }
  bucket.count += 1;
  if (bucket.count > rule.limit) throw new RateLimitError(retryAfter);
}
