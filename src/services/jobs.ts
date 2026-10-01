import "server-only";
import { getEnv, isAiConfigured } from "@/lib/utils/env";
import { errorMessage } from "@/lib/utils/errors";
import { createLogger } from "@/lib/utils/logger";
import { processPendingEmails } from "./ai/processing.service";
import { indexPendingEmails } from "./embeddings/indexer";

const log = createLogger("jobs");

/**
 * Background work after new mail arrives. Route handlers schedule this with Next's
 * `after()`, so the HTTP response returns immediately and the work continues afterwards.
 *
 * 1. Embeddings first — no LLM needed, so semantic search works within seconds.
 * 2. Then the AI pipeline, if an API key is set and auto-processing is on.
 *
 * Production note: on serverless hosts, long `after()` work is bounded by the function's
 * max duration. For large mailboxes, move this to a worker (e.g. a BullMQ queue on Redis).
 */
export async function runPostSyncJobs(userId: string): Promise<void> {
  try {
    await indexPendingEmails(userId);
  } catch (err) {
    log.warn("Embedding job failed", { error: errorMessage(err) });
  }
  if (!isAiConfigured() || !getEnv().AI_AUTO_PROCESS) return;
  try {
    await processPendingEmails(userId);
    // Emails processed after their first indexing don't need re-embedding; but drafts sent
    // in the meantime may have added messages, so do one more cheap indexing pass.
    await indexPendingEmails(userId);
  } catch (err) {
    log.warn("AI processing job failed", { error: errorMessage(err) });
  }
}
