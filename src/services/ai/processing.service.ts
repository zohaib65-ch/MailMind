import "server-only";
import { connectDb, isObjectId, toObjectId } from "@/lib/db/mongoose";
import { Email, type IEmail } from "@/lib/db/models";
import { acquireLock } from "@/lib/utils/cache";
import { isAiConfigured } from "@/lib/utils/env";
import { AiNotConfiguredError, ConflictError, errorMessage, NotFoundError } from "@/lib/utils/errors";
import { createLogger } from "@/lib/utils/logger";
import { trackAiTask } from "./ai-task.service";
import { loadEmailContext } from "./context";
import { runEmailPipeline, type PipelineResult, type PipelineStepEvent } from "./pipeline";

const log = createLogger("processing");

/** A claim older than this is assumed to belong to a crashed worker and can be retaken. */
const STALE_CLAIM_MS = 10 * 60_000;

/**
 * Atomically moves an email to "processing" so two workers can never run the pipeline on
 * the same email at once. Returns null if someone else holds it.
 */
async function claimEmail(userId: string, emailId: string, force: boolean): Promise<IEmail | null> {
  const claimable: Record<string, unknown>[] = [
    { "ai.status": { $in: ["pending", "failed"] } },
    { "ai.status": "processing", "ai.claimedAt": { $lt: new Date(Date.now() - STALE_CLAIM_MS) } },
  ];
  if (force) claimable.push({ "ai.status": { $in: ["processed", "skipped"] } });
  return (await Email.findOneAndUpdate(
    { _id: toObjectId(emailId), userId: toObjectId(userId), $or: claimable },
    { $set: { "ai.status": "processing", "ai.claimedAt": new Date(), "ai.error": null } },
    { returnDocument: "after" },
  ).lean()) as IEmail | null;
}

export async function processEmail(
  userId: string,
  emailId: string,
  options: { force?: boolean; onStep?: (event: PipelineStepEvent) => void } = {},
): Promise<PipelineResult> {
  if (!isAiConfigured()) throw new AiNotConfiguredError();
  await connectDb();
  if (!isObjectId(emailId)) throw new NotFoundError("Email");

  const claimed = await claimEmail(userId, emailId, options.force ?? false);
  if (!claimed) {
    const exists = await Email.exists({ _id: toObjectId(emailId), userId: toObjectId(userId) });
    if (!exists) throw new NotFoundError("Email");
    throw new ConflictError("This email is already being processed (or is already done — use reprocess)");
  }

  try {
    const ctx = await loadEmailContext(userId, emailId);
    return await trackAiTask(
      { userId, emailId, type: "pipeline", input: { direction: ctx.email.direction } },
      async () => {
        const result = await runEmailPipeline(ctx, options.onStep);
        return { result, output: { runId: result.runId, category: result.category, urgency: result.urgency, errors: result.errors } };
      },
    );
  } catch (err) {
    await Email.updateOne({ _id: claimed._id }, { $set: { "ai.status": "failed", "ai.error": errorMessage(err) } });
    log.warn("Pipeline failed", { emailId, error: errorMessage(err) });
    throw err;
  }
}

/**
 * Processes pending emails for a user. Picks the *newest* `limit` pending emails (what you
 * are most likely to read), then runs them oldest-first so thread memory is built in
 * conversation order. Emails in the same thread are done one after another; different
 * threads can run in parallel (`concurrency`, default 1 to stay within Gemini rate limits).
 */
export async function processPendingEmails(
  userId: string,
  options: {
    limit?: number;
    concurrency?: number;
    /** Only these emails (e.g. the ones a sync just imported). */
    emailIds?: string[];
    /** Only emails stored in MailMind after this time. */
    createdAfter?: Date;
  } = {},
): Promise<{ processed: number; failed: number; skipped: boolean }> {
  if (!isAiConfigured()) return { processed: 0, failed: 0, skipped: true };
  await connectDb();
  const release = await acquireLock(`ai-process:${userId}`, 30 * 60);
  if (!release) return { processed: 0, failed: 0, skipped: true };

  let processed = 0;
  let failed = 0;
  try {
    const filter: Record<string, unknown> = { userId: toObjectId(userId), "ai.status": "pending" };
    if (options.emailIds) filter._id = { $in: options.emailIds.filter(isObjectId).map(toObjectId) };
    if (options.createdAfter) filter.createdAt = { $gt: options.createdAfter };
    const newest = await Email.find(filter)
      .sort({ receivedAt: -1 })
      .limit(options.limit ?? 50)
      .select("_id threadId")
      .lean();
    const pending = newest.reverse();

    const byThread = new Map<string, string[]>();
    for (const e of pending) {
      const key = e.threadId.toString();
      byThread.set(key, [...(byThread.get(key) ?? []), e._id.toString()]);
    }
    const queues = [...byThread.values()];
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(options.concurrency ?? 1, queues.length) }, async () => {
        while (next < queues.length) {
          const queue = queues[next++]!;
          for (const emailId of queue) {
            try {
              await processEmail(userId, emailId);
              processed++;
            } catch (err) {
              failed++;
              if (err instanceof AiNotConfiguredError) return;
            }
          }
        }
      }),
    );
    log.info("Batch processing finished", { userId, processed, failed });
    return { processed, failed, skipped: false };
  } finally {
    await release();
  }
}

export async function getProcessingStatus(userId: string) {
  await connectDb();
  const rows = await Email.aggregate<{ _id: string; count: number }>([
    { $match: { userId: toObjectId(userId) } },
    { $group: { _id: "$ai.status", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(rows.map((r) => [r._id, r.count])) as Record<string, number>;
  return {
    aiConfigured: isAiConfigured(),
    pending: counts.pending ?? 0,
    processing: counts.processing ?? 0,
    processed: counts.processed ?? 0,
    failed: counts.failed ?? 0,
  };
}
