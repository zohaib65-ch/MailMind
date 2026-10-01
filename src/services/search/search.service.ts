import "server-only";
import { connectDb, toObjectId } from "@/lib/db/mongoose";
import { Email, type IEmail } from "@/lib/db/models";
import { vectorSearch } from "@/lib/vector/atlas-vector";
import { cacheGet, cacheSet } from "@/lib/utils/cache";
import { sha256 } from "@/lib/utils/crypto";
import { getEmbeddingsConfig } from "@/services/embeddings/providers";
import { toEmailListItem } from "@/services/email/dto";
import type { SearchMode, SearchResultDTO } from "@/types/email";
import { reciprocalRankFusion } from "./rrf";

type Ranked = { id: string; score: number; excerpt?: string };

/** Classic keyword search via MongoDB's $text index (stemmed words, not meaning). */
async function keywordSearch(userId: string, query: string, limit: number): Promise<Ranked[]> {
  const docs = await Email.find(
    { userId: toObjectId(userId), $text: { $search: query } },
    { score: { $meta: "textScore" } },
  )
    .select("_id")
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .lean<{ _id: IEmail["_id"]; score: number }[]>();
  return docs.map((d) => ({ id: d._id.toString(), score: d.score }));
}

async function embedQuery(query: string): Promise<number[]> {
  const { embeddings, model } = getEmbeddingsConfig();
  const key = `qemb:${model}:${sha256(query.toLowerCase().trim())}`;
  const cached = await cacheGet<number[]>(key);
  if (cached) return cached;
  const vector = await embeddings.embedQuery(query);
  await cacheSet(key, vector, 60 * 60);
  return vector;
}

/** Semantic search: embed the question, find the nearest email chunks, best chunk per email. */
async function semanticSearch(userId: string, query: string, limit: number) {
  const { model, dimensions } = getEmbeddingsConfig();
  const { hits, engine } = await vectorSearch({ userId, model, dimensions, queryVector: await embedQuery(query), limit: limit * 4 });
  const best = new Map<string, Ranked>();
  for (const hit of hits) {
    const current = best.get(hit.emailId);
    if (!current || hit.score > current.score) best.set(hit.emailId, { id: hit.emailId, score: hit.score, excerpt: hit.content });
  }
  return { ranked: [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit), engine };
}

function excerptOf(chunk: string | undefined): string | undefined {
  if (!chunk) return undefined;
  // Drop the contextual header (subject/from/date) that was added for embedding.
  const body = chunk.split("\n\n").slice(1).join("\n\n").trim() || chunk;
  return body.length > 280 ? `${body.slice(0, 279)}…` : body;
}

export async function searchEmails(
  userId: string,
  options: { query: string; mode?: SearchMode; limit?: number },
): Promise<{ results: SearchResultDTO[]; engine?: "atlas" | "exact" }> {
  await connectDb();
  const query = options.query.trim();
  if (!query) return { results: [] };
  const mode = options.mode ?? "hybrid";
  const limit = Math.min(options.limit ?? 20, 50);

  const [keyword, semantic] = await Promise.all([
    mode === "semantic" ? Promise.resolve([] as Ranked[]) : keywordSearch(userId, query, limit),
    mode === "keyword" ? Promise.resolve(null) : semanticSearch(userId, query, limit),
  ]);

  let ordered: { id: string; score: number; matchedBy: ("keyword" | "semantic")[]; excerpt?: string }[];
  if (mode === "keyword") {
    ordered = keyword.map((k) => ({ id: k.id, score: k.score, matchedBy: ["keyword"] }));
  } else if (mode === "semantic") {
    ordered = semantic!.ranked.map((s) => ({ id: s.id, score: s.score, matchedBy: ["semantic"], excerpt: s.excerpt }));
  } else {
    ordered = reciprocalRankFusion<Ranked>([
      { name: "keyword", items: keyword },
      { name: "semantic", items: semantic!.ranked },
    ]).map((f) => ({
      id: f.id,
      score: f.score,
      matchedBy: f.matchedBy as ("keyword" | "semantic")[],
      excerpt: semantic!.ranked.find((s) => s.id === f.id)?.excerpt,
    }));
  }
  ordered = ordered.slice(0, limit);

  const docs = await Email.find({ _id: { $in: ordered.map((o) => toObjectId(o.id)) }, userId: toObjectId(userId) }).lean();
  const byId = new Map(docs.map((d) => [d._id.toString(), d as IEmail]));
  const results = ordered
    .filter((o) => byId.has(o.id))
    .map((o) => ({
      email: toEmailListItem(byId.get(o.id)!),
      score: o.score,
      matchedBy: o.matchedBy,
      excerpt: excerptOf(o.excerpt),
    }));
  return { results, engine: semantic?.engine };
}
