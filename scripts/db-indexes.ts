/**
 * Creates every MongoDB index MailMind needs: `npm run db:indexes`.
 * These are the indexes declared on the Mongoose schemas (unique keys, TTLs, the $text index).
 */
import "./_env";
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "@/lib/db/mongoose";
import "@/lib/db/models";

async function main() {
  await connectDb();
  for (const model of Object.values(mongoose.models)) {
    await model.syncIndexes();
    console.log(`✓ indexes for ${model.collection.collectionName}`);
  }
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
