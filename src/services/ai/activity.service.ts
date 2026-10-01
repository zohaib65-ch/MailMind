import "server-only";
import { connectDb, isObjectId, toObjectId } from "@/lib/db/mongoose";
import { AiTask, ToolExecution } from "@/lib/db/models";
import type { ActivityItemDTO } from "@/types/email";

/** The AI audit trail: every AI step and tool call, newest first. */
export async function listActivity(
  userId: string,
  options: { limit?: number; emailId?: string; conversationId?: string } = {},
): Promise<ActivityItemDTO[]> {
  await connectDb();
  const limit = Math.min(options.limit ?? 50, 200);
  const filter: Record<string, unknown> = { userId: toObjectId(userId) };
  if (options.emailId && isObjectId(options.emailId)) filter.emailId = toObjectId(options.emailId);
  if (options.conversationId && isObjectId(options.conversationId)) filter.conversationId = toObjectId(options.conversationId);

  const [tasks, tools] = await Promise.all([
    AiTask.find(filter).sort({ startedAt: -1 }).limit(limit).lean(),
    ToolExecution.find(filter).sort({ startedAt: -1 }).limit(limit).lean(),
  ]);

  const items: ActivityItemDTO[] = [
    ...tasks.map((t) => ({
      id: t._id.toString(),
      kind: "ai_task" as const,
      name: t.type,
      status: t.status,
      summary: summarizeTaskOutput(t.type, t.output),
      error: t.error,
      emailId: t.emailId?.toString(),
      conversationId: t.conversationId?.toString(),
      model: t.model,
      inputTokens: t.inputTokens,
      outputTokens: t.outputTokens,
      latencyMs: t.latencyMs,
      startedAt: t.startedAt.toISOString(),
    })),
    ...tools.map((t) => ({
      id: t._id.toString(),
      kind: "tool" as const,
      name: t.toolName,
      status: t.status,
      summary: t.summary,
      error: t.error,
      emailId: t.emailId?.toString(),
      conversationId: t.conversationId?.toString(),
      latencyMs: t.latencyMs,
      startedAt: t.startedAt.toISOString(),
      source: t.source,
    })),
  ];
  return items.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
}

/** A short human-readable line for each task type (never raw model output). */
function summarizeTaskOutput(type: string, output: unknown): string | undefined {
  const o = (output ?? {}) as Record<string, unknown>;
  switch (type) {
    case "classify":
      return o.category ? `Category: ${o.category} (${Math.round(Number(o.confidence ?? 0) * 100)}%)` : undefined;
    case "urgency":
      return o.urgency ? `Urgency: ${o.urgency}` : (o.reason as string | undefined);
    case "extract": {
      const dropped = Array.isArray(o.droppedAsUngrounded) ? o.droppedAsUngrounded.length : 0;
      const tasks = (o.extracted as { tasks?: unknown[] } | undefined)?.tasks?.length ?? 0;
      return `${tasks} task${tasks === 1 ? "" : "s"} extracted${dropped ? `, ${dropped} unverified value${dropped === 1 ? "" : "s"} dropped` : ""}`;
    }
    case "summarize":
      return "Summary generated";
    case "draft_reply":
      return o.subject ? `Drafted “${o.subject}”` : "Reply drafted";
    case "memory_update":
      return "Conversation memory updated";
    case "pipeline":
      return o.category ? `Processed → ${o.category}${o.urgency ? `, ${o.urgency}` : ""}` : "Pipeline run";
    case "agent_run":
      return o.paused ? "Paused for your approval" : `Assistant run (${o.toolSteps ?? 0} tool calls)`;
    case "rag_answer":
      return "Answered a question from your inbox";
    case "action_decision":
      return "Decided actions";
    default:
      return (o.reason as string | undefined) ?? undefined;
  }
}
