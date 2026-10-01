import "server-only";
import { toObjectId } from "@/lib/db/mongoose";
import { AiTask, type AiTaskType } from "@/lib/db/models";
import type { TokenUsage } from "@/lib/langchain/structured";
import { errorMessage } from "@/lib/utils/errors";

export type AiTaskMeta = {
  userId: string;
  type: AiTaskType;
  emailId?: string;
  conversationId?: string;
  pipelineRunId?: string;
  input?: unknown;
};

export type TrackedOutcome<T> = {
  result: T;
  /** What to store as the task's output (defaults to `result`). Keep it small. */
  output?: unknown;
  usage?: TokenUsage;
  model?: string;
};

/**
 * Wraps one AI step so it is recorded in the `ai_tasks` collection with its status,
 * output, token usage and latency. This is what the Activity page shows.
 */
export async function trackAiTask<T>(meta: AiTaskMeta, run: () => Promise<TrackedOutcome<T>>): Promise<T> {
  const started = Date.now();
  const task = await AiTask.create({
    userId: toObjectId(meta.userId),
    type: meta.type,
    emailId: meta.emailId ? toObjectId(meta.emailId) : undefined,
    conversationId: meta.conversationId ? toObjectId(meta.conversationId) : undefined,
    pipelineRunId: meta.pipelineRunId,
    input: meta.input,
    status: "running",
  });
  try {
    const outcome = await run();
    await AiTask.updateOne(
      { _id: task._id },
      {
        $set: {
          status: "succeeded",
          output: outcome.output ?? outcome.result,
          model: outcome.model,
          inputTokens: outcome.usage?.inputTokens,
          outputTokens: outcome.usage?.outputTokens,
          latencyMs: Date.now() - started,
          finishedAt: new Date(),
        },
      },
    );
    return outcome.result;
  } catch (err) {
    await AiTask.updateOne(
      { _id: task._id },
      { $set: { status: "failed", error: errorMessage(err), latencyMs: Date.now() - started, finishedAt: new Date() } },
    );
    throw err;
  }
}

/** For long-running or streaming work that can't be wrapped in a single promise. */
export async function startAiTask(meta: AiTaskMeta) {
  const started = Date.now();
  const task = await AiTask.create({
    userId: toObjectId(meta.userId),
    type: meta.type,
    emailId: meta.emailId ? toObjectId(meta.emailId) : undefined,
    conversationId: meta.conversationId ? toObjectId(meta.conversationId) : undefined,
    pipelineRunId: meta.pipelineRunId,
    input: meta.input,
    status: "running",
  });
  const finish = (set: Record<string, unknown>) =>
    AiTask.updateOne({ _id: task._id }, { $set: { ...set, latencyMs: Date.now() - started, finishedAt: new Date() } });
  return {
    succeed: (output?: unknown) => finish({ status: "succeeded", output }),
    fail: (err: unknown) => finish({ status: "failed", error: errorMessage(err) }),
  };
}

export async function recordSkippedTask(meta: AiTaskMeta, reason: string): Promise<void> {
  await AiTask.create({
    userId: toObjectId(meta.userId),
    type: meta.type,
    emailId: meta.emailId ? toObjectId(meta.emailId) : undefined,
    pipelineRunId: meta.pipelineRunId,
    status: "skipped",
    output: { reason },
    latencyMs: 0,
    finishedAt: new Date(),
  });
}
