import "server-only";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { VoyageAIClient } from "voyageai";
import { getEmbeddingsProviderName, getEnv } from "@/lib/utils/env";
import { AppError } from "@/lib/utils/errors";

/**
 * Embedding providers, implemented as LangChain `Embeddings` so they plug into any
 * LangChain retriever or vector store.
 *
 *  - Voyage AI (recommended, the embedding provider Anthropic recommends): real semantic
 *    vectors. Set VOYAGE_API_KEY.
 *  - Mock: offline, deterministic "hashing" embeddings for development without a key.
 *    These are lexical with a small synonym table — good enough to demo the plumbing,
 *    not a substitute for a real model.
 */

export class VoyageEmbeddings extends Embeddings {
  private readonly client: VoyageAIClient;

  constructor(
    private readonly options: { apiKey: string; model: string; dimensions: number },
    params: EmbeddingsParams = {},
  ) {
    super({ maxRetries: 3, ...params });
    this.client = new VoyageAIClient({ apiKey: options.apiKey });
  }

  private async embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
    const out: number[][] = [];
    // Voyage accepts up to 128 inputs per request.
    for (let i = 0; i < texts.length; i += 128) {
      const batch = texts.slice(i, i + 128);
      const res = await this.caller.call(() =>
        this.client.embed({
          input: batch,
          model: this.options.model,
          inputType,
          outputDimension: this.options.dimensions,
        }),
      );
      const rows = [...(res.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      for (const row of rows) {
        if (!row.embedding) throw new AppError("Voyage returned an empty embedding", 502);
        out.push(row.embedding);
      }
    }
    return out;
  }

  embedDocuments(documents: string[]): Promise<number[][]> {
    return this.embed(documents, "document");
  }

  async embedQuery(query: string): Promise<number[]> {
    return (await this.embed([query], "query"))[0]!;
  }
}

// ─── Mock (offline) embeddings ────────────────────────────────────────────────

const STOPWORDS = new Set(
  "a an and are as at be but by for from has have i if in into is it its me my of on or our so that the their them then there these they this to us was we were will with you your yours can could would should please just also".split(
    " ",
  ),
);

/** Maps related words onto one "concept" token so they land in the same vector bucket. */
const CONCEPTS: Record<string, string> = {
  payment: "payment", pay: "payment", paid: "payment", invoice: "payment", billing: "payment", bill: "payment",
  billed: "payment", charge: "payment", charged: "payment", refund: "payment", receipt: "payment", transfer: "payment",
  card: "payment", subscription: "payment", price: "payment", pricing: "payment",
  fail: "problem", failed: "problem", failure: "problem", declined: "problem", bounced: "problem", rejected: "problem",
  problem: "problem", issue: "problem", bug: "problem", broken: "problem", error: "problem", trouble: "problem",
  twice: "problem", duplicate: "problem", blocking: "problem",
  interview: "hiring", candidate: "hiring", recruiter: "hiring", hiring: "hiring", panel: "hiring",
  meeting: "meeting", call: "meeting", sync: "meeting", demo: "meeting", schedule: "meeting", scheduled: "meeting",
  deliver: "delivery", delivery: "delivery", deadline: "delivery", due: "delivery", ship: "delivery", shipped: "delivery",
  launch: "delivery", friday: "delivery",
  security: "security", password: "security", verify: "security", suspicious: "security", unusual: "security",
  login: "security", sign: "security",
};

function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class MockEmbeddings extends Embeddings {
  constructor(readonly dimensions = 384) {
    super({});
  }

  private vector(text: string): number[] {
    const words = text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w));
    // Feature presence (not counts), so long emails and repeated words don't dominate.
    const features = new Map<string, number>();
    words.forEach((word, i) => {
      const s = stem(word);
      features.set(`w:${s}`, 1);
      const concept = CONCEPTS[word] ?? CONCEPTS[s];
      if (concept) features.set(`c:${concept}`, 2.5);
      if (i > 0) features.set(`b:${stem(words[i - 1]!)}_${s}`, 0.5);
    });
    const vec = new Array<number>(this.dimensions).fill(0);
    for (const [feature, weight] of features) {
      const h = fnv1a(feature);
      vec[h % this.dimensions]! += (h & 0x80000000 ? -1 : 1) * weight;
    }
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((d) => this.vector(d));
  }

  async embedQuery(query: string): Promise<number[]> {
    return this.vector(query);
  }
}

export type EmbeddingsConfig = { embeddings: Embeddings; model: string; dimensions: number; provider: "voyage" | "mock" };

let cached: EmbeddingsConfig | undefined;

export function getEmbeddingsConfig(): EmbeddingsConfig {
  if (cached) return cached;
  const env = getEnv();
  if (getEmbeddingsProviderName() === "voyage") {
    if (!env.VOYAGE_API_KEY) throw new AppError("EMBEDDINGS_PROVIDER=voyage needs VOYAGE_API_KEY", 503, "embeddings_not_configured");
    cached = {
      provider: "voyage",
      model: env.VOYAGE_MODEL,
      dimensions: env.VOYAGE_DIMENSIONS,
      embeddings: new VoyageEmbeddings({ apiKey: env.VOYAGE_API_KEY, model: env.VOYAGE_MODEL, dimensions: env.VOYAGE_DIMENSIONS }),
    };
  } else {
    cached = { provider: "mock", model: "mock-hash-384", dimensions: 384, embeddings: new MockEmbeddings(384) };
  }
  return cached;
}
