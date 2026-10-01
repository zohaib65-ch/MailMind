import "server-only";
import { toObjectId } from "@/lib/db/mongoose";
import { EmailEmbedding } from "@/lib/db/models";
import { cacheGet, cacheSet } from "@/lib/utils/cache";
import { getEnv } from "@/lib/utils/env";
import { errorMessage } from "@/lib/utils/errors";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("vector");

/*
 * Vector search over the `email_embeddings` collection.
 *
 * On MongoDB Atlas this runs `$vectorSearch` against an Atlas Vector Search index
 * (approximate nearest neighbours, scales to millions of chunks). Anywhere else — local
 * mongod, the in-memory test server, or Atlas before the index has finished building — it
 * falls back to exact cosine similarity computed in Node, which is fine for one inbox.
 */

export type VectorHit = { emailId: string; chunkId: string; content: string; score: number };

/** Atlas index definition. `filter` fields let $vectorSearch pre-filter by user and model. */
export function vectorIndexDefinition(dimensions: number) {
  return {
    fields: [
      { type: "vector", path: "embedding", numDimensions: dimensions, similarity: "cosine" },
      { type: "filter", path: "userId" },
      { type: "filter", path: "model" },
    ],
  };
}

type SearchIndexInfo = { name: string; queryable?: boolean; status?: string; latestDefinition?: { fields?: { type: string; numDimensions?: number }[] } };

async function listSearchIndexes(): Promise<SearchIndexInfo[]> {
  return (await EmailEmbedding.collection.listSearchIndexes().toArray()) as SearchIndexInfo[];
}

/** Is the Atlas vector index present and ready for this dimension? Cached for a minute. */
export async function isVectorIndexQueryable(dimensions: number): Promise<boolean> {
  const name = getEnv().ATLAS_VECTOR_INDEX;
  const key = `vector-index:${name}:${dimensions}`;
  const cached = await cacheGet<boolean>(key);
  if (cached !== null) return cached;
  let ready = false;
  try {
    const index = (await listSearchIndexes()).find((i) => i.name === name);
    const dims = index?.latestDefinition?.fields?.find((f) => f.type === "vector")?.numDimensions;
    ready = Boolean(index?.queryable) && dims === dimensions;
  } catch {
    ready = false; // Not Atlas: search indexes are unsupported here.
  }
  await cacheSet(key, ready, 60);
  return ready;
}

/** Creates (or recreates, if the dimension changed) the Atlas vector index. Atlas only. */
export async function ensureVectorIndex(dimensions: number): Promise<"created" | "exists" | "updated" | "unsupported"> {
  const name = getEnv().ATLAS_VECTOR_INDEX;
  let indexes: SearchIndexInfo[];
  try {
    indexes = await listSearchIndexes();
  } catch (err) {
    log.warn("Search indexes are not supported on this deployment (Atlas only)", { error: errorMessage(err) });
    return "unsupported";
  }
  const existing = indexes.find((i) => i.name === name);
  const definition = vectorIndexDefinition(dimensions);
  if (!existing) {
    await EmailEmbedding.collection.createSearchIndex({ name, type: "vectorSearch", definition });
    return "created";
  }
  const dims = existing.latestDefinition?.fields?.find((f) => f.type === "vector")?.numDimensions;
  if (dims === dimensions) return "exists";
  await EmailEmbedding.collection.updateSearchIndex(name, definition);
  return "updated";
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Exact search in Node. Bounded so a huge mailbox can't exhaust memory. */
async function bruteForceSearch(userId: string, model: string, queryVector: number[], limit: number): Promise<VectorHit[]> {
  const MAX_CHUNKS = 20_000;
  const docs = await EmailEmbedding.find({ userId: toObjectId(userId), model })
    .select("emailId content embedding")
    .sort({ createdAt: -1 })
    .limit(MAX_CHUNKS)
    .lean();
  return docs
    .map((d) => ({ emailId: d.emailId.toString(), chunkId: d._id.toString(), content: d.content, score: cosine(queryVector, d.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function vectorSearch(options: {
  userId: string;
  model: string;
  dimensions: number;
  queryVector: number[];
  limit: number;
}): Promise<{ hits: VectorHit[]; engine: "atlas" | "exact" }> {
  const { userId, model, dimensions, queryVector, limit } = options;
  if (await isVectorIndexQueryable(dimensions)) {
    try {
      const hits = await EmailEmbedding.aggregate<VectorHit>([
        {
          $vectorSearch: {
            index: getEnv().ATLAS_VECTOR_INDEX,
            path: "embedding",
            queryVector,
            numCandidates: Math.max(100, limit * 20),
            limit,
            filter: { userId: toObjectId(userId), model },
          },
        },
        {
          $project: {
            _id: 0,
            chunkId: { $toString: "$_id" },
            emailId: { $toString: "$emailId" },
            content: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ]);
      return { hits, engine: "atlas" };
    } catch (err) {
      log.warn("$vectorSearch failed, falling back to exact search", { error: errorMessage(err) });
    }
  }
  return { hits: await bruteForceSearch(userId, model, queryVector, limit), engine: "exact" };
}
