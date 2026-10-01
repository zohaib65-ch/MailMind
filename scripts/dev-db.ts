/**
 * A local MongoDB for development without Atlas: `npm run db:local`.
 * Data persists in ./.mongo-data. Atlas Vector Search isn't available locally, so semantic
 * search uses MailMind's exact-cosine fallback — fine for a demo inbox.
 */
import "./_env";
import { mkdirSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

async function main() {
  const port = Number(process.env.LOCAL_MONGO_PORT ?? 27017);
  const dbPath = ".mongo-data";
  mkdirSync(dbPath, { recursive: true });

  const server = await MongoMemoryServer.create({ instance: { port, dbPath, storageEngine: "wiredTiger" } });
  console.log(`\n  Local MongoDB running at ${server.getUri()}`);
  console.log(`  Set MONGODB_URI="mongodb://127.0.0.1:${port}" in .env\n  Press Ctrl+C to stop.\n`);

  const stop = async () => {
    await server.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
