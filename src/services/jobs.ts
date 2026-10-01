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
 * 1. Embeddings first — one cheap batch call, so semantic search works within seconds.
 * 2. Then the AI pipeline, if a Gemini key is set and auto-processing is on — but only for
 *    the emails that just arrived (`emailIds`, or anything stored in the last 10 minutes),
 *    and at most AI_AUTO_PROCESS_LIMIT of them, newest first. Older mail from a big first
 *    import stays "not analysed" until you ask (on the email page, or "Analyse with AI" in
 *    the inbox), so frequent polling never quietly works through the Gemini quota.
 *
 * Production note: on serverless hosts, long `after()` work is bounded by the function's
 * max duration. For large mailboxes, move this to a worker (e.g. a BullMQ queue on Redis).
 */
export async function runPostSyncJobs(userId: string, options: { emailIds?: string[] } = {}): Promise<void> {
  try {
    await indexPendingEmails(userId);
  } catch (err) {
    log.warn("Embedding job failed", { error: errorMessage(err) });
  }
  const env = getEnv();
  if (!isAiConfigured() || !env.AI_AUTO_PROCESS || env.AI_AUTO_PROCESS_LIMIT === 0) return;
  try {
    await processPendingEmails(userId, {
      limit: env.AI_AUTO_PROCESS_LIMIT,
      ...(options.emailIds ? { emailIds: options.emailIds } : { createdAfter: new Date(Date.now() - 10 * 60_000) }),
    });
    // Emails processed after their first indexing don't need re-embedding; but drafts sent
    // in the meantime may have added messages, so do one more cheap indexing pass.
    await indexPendingEmails(userId);
  } catch (err) {
    log.warn("AI processing job failed", { error: errorMessage(err) });
  }
}
