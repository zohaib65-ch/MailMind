import "server-only";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { getEnv, getGeminiApiKey } from "@/lib/utils/env";
import { AppError } from "@/lib/utils/errors";

/**
 * Gemini embeddings, implemented as a LangChain `Embeddings` so they plug into any
 * LangChain retriever or vector store. Uses the same Gemini API key as the chat models.
 *
 * Two details that matter for retrieval quality:
 *  - Task types: emails are embedded as RETRIEVAL_DOCUMENT and search queries as
 *    RETRIEVAL_QUERY. Gemini optimises each side for the other.
 *  - Size: `outputDimensionality` truncates the vector (Matryoshka embeddings). We
 *    re-normalise afterwards so cosine similarity and dot product agree.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
/** batchEmbedContents accepts up to 100 inputs per request. */
const BATCH_SIZE = 100;

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

class GeminiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

export class GeminiEmbeddings extends Embeddings {
  constructor(
    private readonly options: { apiKey: string; model: string; dimensions: number },
    params: EmbeddingsParams = {},
  ) {
    // AsyncCaller retries failures with exponential backoff (429s on free-tier keys).
    super({
      maxRetries: 6,
      maxConcurrency: 2,
      onFailedAttempt: (err: unknown) => {
        // Don't retry requests that can never succeed (bad key, bad request).
        if (err instanceof GeminiApiError && [400, 401, 403, 404].includes(err.status)) throw err;
      },
      ...params,
    });
  }

  private async batch(texts: string[], taskType: TaskType): Promise<number[][]> {
    const model = `models/${this.options.model}`;
    const res = await fetch(`${API_BASE}/${model}:batchEmbedContents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.options.apiKey },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: this.options.dimensions,
        })),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new GeminiApiError(`Gemini embeddings failed (${res.status}): ${body?.error?.message ?? res.statusText}`, res.status);
    }
    const data = (await res.json()) as { embeddings?: { values?: number[] }[] };
    const vectors = (data.embeddings ?? []).map((e) => e.values ?? []);
    if (vectors.length !== texts.length || vectors.some((v) => v.length !== this.options.dimensions)) {
      throw new AppError("Gemini returned an unexpected embeddings response", 502);
    }
    return vectors.map(normalize);
  }

  private async embed(texts: string[], taskType: TaskType): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const slice = texts.slice(i, i + BATCH_SIZE);
      out.push(...(await this.caller.call(() => this.batch(slice, taskType))));
    }
    return out;
  }

  embedDocuments(documents: string[]): Promise<number[][]> {
    return this.embed(documents, "RETRIEVAL_DOCUMENT");
  }

  async embedQuery(query: string): Promise<number[]> {
    return (await this.embed([query], "RETRIEVAL_QUERY"))[0]!;
  }
}

export type EmbeddingsConfig = { embeddings: Embeddings; model: string; dimensions: number; provider: "gemini" };

let cached: EmbeddingsConfig | undefined;

export function isEmbeddingsConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

export function getEmbeddingsConfig(): EmbeddingsConfig {
  if (cached) return cached;
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new AppError("Semantic search needs GEMINI_API_KEY", 503, "embeddings_not_configured");
  const env = getEnv();
  cached = {
    provider: "gemini",
    model: env.GEMINI_EMBEDDING_MODEL,
    dimensions: env.EMBEDDING_DIMENSIONS,
    embeddings: new GeminiEmbeddings({ apiKey, model: env.GEMINI_EMBEDDING_MODEL, dimensions: env.EMBEDDING_DIMENSIONS }),
  };
  return cached;
}

/** Model + dimensions without requiring a key (for status displays). */
export function getEmbeddingsInfo(): { provider: "gemini"; model: string; dimensions: number; configured: boolean } {
  const env = getEnv();
  return { provider: "gemini", model: env.GEMINI_EMBEDDING_MODEL, dimensions: env.EMBEDDING_DIMENSIONS, configured: isEmbeddingsConfigured() };
}
