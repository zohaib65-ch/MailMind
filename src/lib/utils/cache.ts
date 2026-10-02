import "server-only";
import { randomBytes } from "node:crypto";
import { getRedis } from "./redis";

/**
 * Short-lived locks: Redis when configured, otherwise an in-process Map with TTLs.
 */
const memory = new Map<string, { value: string; expiresAt: number }>();

function memoryGet(key: string): string | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

// Deletes the lock only if we still own it (compare-and-delete must be atomic in Redis).
const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

/**
 * Best-effort mutual exclusion (SET NX EX). Returns a release function, or null when the
 * lock is already held — e.g. to stop two syncs of the same account running at once.
 */
export async function acquireLock(key: string, ttlSeconds: number): Promise<(() => Promise<void>) | null> {
  const lockKey = `lock:${key}`;
  // A per-holder token: if our lock expired and someone else took it, releasing ours must
  // not delete theirs.
  const token = randomBytes(12).toString("hex");
  const redis = getRedis();
  if (redis) {
    const ok = await redis.set(lockKey, token, "EX", ttlSeconds, "NX").catch(() => null);
    return ok ? async () => void (await redis.eval(RELEASE_SCRIPT, 1, lockKey, token).catch(() => undefined)) : null;
  }
  if (memoryGet(lockKey)) return null;
  memory.set(lockKey, { value: token, expiresAt: Date.now() + ttlSeconds * 1000 });
  return async () => {
    if (memory.get(lockKey)?.value === token) memory.delete(lockKey);
  };
}
