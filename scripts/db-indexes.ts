/**
 * Creates every MongoDB index MailMind needs: `npm run db:indexes`.
 *  - regular indexes declared on the Mongoose schemas (unique keys, TTLs, the $text index)
 *  - the Atlas Vector Search index on email_embeddings (Atlas only; skipped elsewhere)
 */
import "./_env";
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "@/lib/db/mongoose";
import "@/lib/db/models";
import { ensureVectorIndex } from "@/lib/vector/atlas-vector";
import { getEmbeddingsConfig } from "@/services/embeddings/providers";

async function main() {
  await connectDb();
  for (const model of Object.values(mongoose.models)) {
    await model.syncIndexes();
    console.log(`✓ indexes for ${model.collection.collectionName}`);
  }
  const { dimensions, model } = getEmbeddingsConfig();
  const result = await ensureVectorIndex(dimensions);
  console.log(
    result === "unsupported"
      ? "• Atlas Vector Search not available on this deployment — semantic search will use exact cosine similarity."
      : `✓ Atlas vector index ${result} (${dimensions} dims for ${model}). It can take a minute to become queryable.`,
  );
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
