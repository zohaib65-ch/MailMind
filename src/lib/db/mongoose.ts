import "server-only";
import mongoose from "mongoose";
import { getEnv } from "@/lib/utils/env";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("db");

// Next.js dev reloads modules on every edit; caching the connection on globalThis stops
// each reload from opening a new connection pool.
const globalForMongoose = globalThis as unknown as {
  mailmindMongoose?: { promise: Promise<typeof mongoose> | null };
};
const cache = (globalForMongoose.mailmindMongoose ??= { promise: null });

mongoose.set("strictQuery", true);

export async function connectDb(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!cache.promise) {
    const env = getEnv();
    cache.promise = mongoose
      .connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DB,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10_000,
        // Indexes are created explicitly with `npm run db:indexes`, not on every boot.
        autoIndex: env.NODE_ENV !== "production",
      })
      .then((m) => {
        log.info("Connected to MongoDB", { db: env.MONGODB_DB });
        return m;
      })
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }
  return cache.promise;
}

export async function disconnectDb(): Promise<void> {
  cache.promise = null;
  await mongoose.disconnect();
}

/** Accepts only valid 24-hex ObjectId strings — anything else from a URL is a 404, not a crash. */
export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{24}$/i.test(value);
}

export function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}
