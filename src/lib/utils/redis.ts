import "server-only";
import Redis from "ioredis";
import { getEnv } from "./env";
import { createLogger } from "./logger";

const log = createLogger("redis");

const globalForRedis = globalThis as unknown as { mailmindRedis?: Redis | null };

/**
 * Redis is optional. When REDIS_URL is unset this returns null and callers fall back to
 * in-process memory (fine for a single dev server, not for multiple instances).
 */
export function getRedis(): Redis | null {
  if (globalForRedis.mailmindRedis !== undefined) return globalForRedis.mailmindRedis;
  const url = getEnv().REDIS_URL;
  if (!url) {
    globalForRedis.mailmindRedis = null;
    return null;
  }
  const client = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false });
  client.on("error", (err) => log.warn("Redis error", { message: err.message }));
  globalForRedis.mailmindRedis = client;
  return client;
}
