import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let server: MongoMemoryServer | undefined;

/** Starts a throwaway MongoDB and points the app at it. Call in beforeAll. */
export async function startTestDb() {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  const { connectDb } = await import("@/lib/db/mongoose");
  await connectDb();
  // Build indexes up front (the $text index is needed by keyword search).
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export async function stopTestDb() {
  const { disconnectDb } = await import("@/lib/db/mongoose");
  await disconnectDb();
  await server?.stop();
}

export async function clearTestDb() {
  const db = mongoose.connection.db;
  if (!db) return;
  for (const c of await db.collections()) await c.deleteMany({});
}
