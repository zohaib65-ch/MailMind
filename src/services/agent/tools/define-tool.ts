import "server-only";
import { tool, type ToolRuntime } from "@langchain/core/tools";
import { isGraphBubbleUp } from "@langchain/langgraph";
import type { z } from "zod";
import { toObjectId } from "@/lib/db/mongoose";
import { ToolExecution } from "@/lib/db/models";
import { randomToken } from "@/lib/utils/crypto";
import { errorMessage } from "@/lib/utils/errors";
import { createLogger } from "@/lib/utils/logger";
import type { ActivityStep, AgentStreamEvent } from "@/types/agent";

const log = createLogger("agent-tools");

/** Who the agent is working for. Every tool is bound to this user — no tool can reach another user's data. */
export type AgentToolContext = {
  userId: string;
  userName: string;
  userEmail: string;
  conversationId: string;
};

export type ToolOutcome<R> = {
  /** Returned to the model (as JSON). Keep it compact — it costs tokens. */
  result: R;
  /** Safe one-liner for the activity feed, e.g. "Found 8 emails". */
  summary: string;
  /** Extra UI events, e.g. a draft card. */
  events?: AgentStreamEvent[];
};

const MAX_LOGGED_OUTPUT = 4_000;

function emit(runtime: ToolRuntime | undefined, event: AgentStreamEvent) {
  runtime?.writer?.(event);
}

/**
 * Wraps a tool implementation with the plumbing every MailMind tool needs:
 *  - input validation (the Zod schema is also what the model sees as the tool's parameters)
 *  - an audit record in `tool_executions`
 *  - live, safe activity events for the UI ("🔎 Searching emails…" → "✓ Found 8 emails")
 *  - errors returned to the model as data, so it can recover instead of crashing the run
 */
export function defineAgentTool<S extends z.ZodObject, R>(
  ctx: AgentToolContext,
  spec: {
    name: string;
    description: string;
    schema: S;
    icon: string;
    label: (input: z.infer<S>) => string;
    run: (input: z.infer<S>, runtime: ToolRuntime) => Promise<ToolOutcome<R>>;
  },
) {
  return tool(
    async (input: z.infer<S>, runtime: ToolRuntime) => {
      const toolCallId = runtime?.toolCallId ?? `call_${randomToken(8)}`;
      const started = Date.now();
      const step: ActivityStep = {
        id: toolCallId,
        tool: spec.name,
        icon: spec.icon,
        label: spec.label(input),
        status: "running",
        startedAt: new Date(started).toISOString(),
      };
      emit(runtime, { type: "activity", step });

      const filter = { userId: toObjectId(ctx.userId), toolCallId };
      await ToolExecution.updateOne(
        filter,
        {
          $setOnInsert: {
            source: "agent",
            conversationId: toObjectId(ctx.conversationId),
            toolName: spec.name,
            input,
            startedAt: new Date(started),
          },
          $set: { status: "running" },
        },
        { upsert: true },
      );

      try {
        const outcome = await spec.run(input, runtime);
        const json = JSON.stringify(outcome.result);
        await ToolExecution.updateOne(filter, {
          $set: {
            status: "succeeded",
            summary: outcome.summary,
            output: json.length > MAX_LOGGED_OUTPUT ? { truncated: json.slice(0, MAX_LOGGED_OUTPUT) } : outcome.result,
            latencyMs: Date.now() - started,
            finishedAt: new Date(),
          },
        });
        for (const event of outcome.events ?? []) emit(runtime, event);
        emit(runtime, {
          type: "activity",
          step: { ...step, status: "done", detail: outcome.summary, finishedAt: new Date().toISOString() },
        });
        return json;
      } catch (err) {
        // LangGraph's interrupt() works by throwing; it must propagate so the run can pause.
        if (isGraphBubbleUp(err)) {
          await ToolExecution.updateOne(filter, { $set: { status: "awaiting_approval", summary: "Waiting for your approval" } });
          emit(runtime, { type: "activity", step: { ...step, status: "awaiting_approval", detail: "Waiting for your approval" } });
          throw err;
        }
        const message = errorMessage(err);
        log.warn("Tool failed", { tool: spec.name, error: message });
        await ToolExecution.updateOne(filter, {
          $set: { status: "failed", error: message, latencyMs: Date.now() - started, finishedAt: new Date() },
        });
        emit(runtime, {
          type: "activity",
          step: { ...step, status: "error", detail: message, finishedAt: new Date().toISOString() },
        });
        return JSON.stringify({ error: message });
      }
    },
    { name: spec.name, description: spec.description, schema: spec.schema },
  );
}
