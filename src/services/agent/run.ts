import "server-only";
import { AIMessage, AIMessageChunk, HumanMessage } from "@langchain/core/messages";
import { Command, type Interrupt } from "@langchain/langgraph";
import { User } from "@/lib/db/models";
import { toObjectId } from "@/lib/db/mongoose";
import { isAiConfigured } from "@/lib/utils/env";
import { AiNotConfiguredError, AppError, ConflictError, errorMessage, NotFoundError } from "@/lib/utils/errors";
import { createLogger } from "@/lib/utils/logger";
import { startAiTask } from "@/services/ai/ai-task.service";
import { approveDraft, getDraft, type DraftEdits } from "@/services/email/draft.service";
import type { ActivityStep, AgentStreamEvent, ApprovalDecision, SendApprovalRequest } from "@/types/agent";
import { createMailAgent } from "./agent";
import {
  appendMessage,
  createConversation,
  getOwnedConversation,
  setPendingApproval,
} from "./conversation.service";

const log = createLogger("agent");

type RunContext = { userId: string; conversationId: string; signal?: AbortSignal };

async function agentFor(ctx: RunContext) {
  const user = await User.findById(toObjectId(ctx.userId)).lean();
  if (!user) throw new NotFoundError("User");
  return createMailAgent({
    userId: ctx.userId,
    userName: user.name ?? user.email.split("@")[0]!,
    userEmail: user.email,
    conversationId: ctx.conversationId,
    memories: (user.memories ?? []).map((m) => m.text),
  });
}

/**
 * Runs the agent and translates LangGraph's stream into MailMind's UI events:
 *   "custom"   → tool activity + draft cards (emitted by the tools themselves)
 *   "messages" → the assistant's answer, token by token
 *   "updates"  → `__interrupt__` when sendEmail pauses for approval
 * The transcript (text + activity + drafts) is saved when the run ends or pauses.
 */
async function* runAgent(
  ctx: RunContext,
  input: { messages: HumanMessage[] } | Command,
): AsyncGenerator<AgentStreamEvent> {
  const agent = await agentFor(ctx);
  const activity = new Map<string, ActivityStep>();
  const draftIds = new Set<string>();
  let text = "";
  let lastMessageId: string | undefined;
  let approval: SendApprovalRequest | null = null;

  const runAndStream = async function* () {
    const stream = await agent.stream(input, {
      configurable: { thread_id: ctx.conversationId },
      streamMode: ["custom", "messages", "updates"],
      recursionLimit: 50,
      signal: ctx.signal,
    });
    for await (const [mode, chunk] of stream as AsyncIterable<[string, unknown]>) {
      if (mode === "custom") {
        const event = chunk as AgentStreamEvent;
        if (event.type === "activity") activity.set(event.step.id, event.step);
        if (event.type === "draft") draftIds.add(event.draft.id);
        yield event;
      } else if (mode === "messages") {
        const [message, metadata] = chunk as [unknown, { langgraph_node?: string }];
        // Streaming models emit AIMessageChunks; non-streaming ones emit one whole AIMessage.
        if (metadata?.langgraph_node !== "model_request") continue;
        if (!AIMessageChunk.isInstance(message) && !AIMessage.isInstance(message)) continue;
        const delta = message.text;
        if (!delta) continue;
        // Separate the text of consecutive model calls (before and after tool use).
        if (lastMessageId && message.id && message.id !== lastMessageId && text) {
          text += "\n\n";
          yield { type: "token", text: "\n\n" } satisfies AgentStreamEvent;
        }
        if (message.id) lastMessageId = message.id;
        text += delta;
        yield { type: "token", text: delta } satisfies AgentStreamEvent;
      } else if (mode === "updates") {
        const interrupts = (chunk as { __interrupt__?: Interrupt<SendApprovalRequest>[] }).__interrupt__;
        const value = interrupts?.[0]?.value;
        if (value?.kind === "send_email") approval = value;
      }
    }
  };

  try {
    yield* runAndStream();
  } catch (err) {
    log.error("Agent run failed", { conversationId: ctx.conversationId, error: errorMessage(err) });
    // Save whatever happened before the failure so the transcript stays truthful.
    if (text || activity.size) {
      await appendMessage(ctx.conversationId, { role: "assistant", content: text, activity: [...activity.values()], draftIds: [...draftIds] });
    }
    throw err;
  }

  if (approval) {
    await setPendingApproval(ctx.conversationId, approval);
    yield { type: "approval_required", approval };
  }
  const content = text.trim() || (approval ? "I've prepared the email. Please review it below before it's sent." : "Done.");
  const messageId = await appendMessage(ctx.conversationId, {
    role: "assistant",
    content,
    activity: [...activity.values()],
    draftIds: [...draftIds],
  });
  yield { type: "done", messageId, content };
}

/** A new user message: starts (or continues) a conversation. */
export async function* streamAgentTurn(options: {
  userId: string;
  conversationId?: string;
  message: string;
  signal?: AbortSignal;
}): AsyncGenerator<AgentStreamEvent> {
  if (!isAiConfigured()) throw new AiNotConfiguredError();
  const conversation = options.conversationId
    ? await getOwnedConversation(options.userId, options.conversationId)
    : await createConversation(options.userId, options.message);
  const conversationId = conversation._id.toString();
  yield { type: "conversation", conversationId, title: conversation.title };

  if (conversation.pendingApproval) {
    throw new ConflictError("Please approve or reject the pending email before sending a new message.");
  }

  await appendMessage(conversationId, { role: "user", content: options.message });
  yield* trackedRun({ userId: options.userId, conversationId, signal: options.signal }, { messages: [new HumanMessage(options.message)] }, {
    message: options.message,
  });
}

/**
 * The user's answer to a paused sendEmail. On approve, the draft is first marked approved
 * in the database (with the user's final edits) — this request *is* the approval — and
 * only then is the agent resumed so its sendEmail tool can send it.
 */
export async function* streamAgentResume(options: {
  userId: string;
  conversationId: string;
  decision: "approve" | "reject";
  edits?: DraftEdits;
  reason?: string;
  signal?: AbortSignal;
}): AsyncGenerator<AgentStreamEvent> {
  if (!isAiConfigured()) throw new AiNotConfiguredError();
  const conversation = await getOwnedConversation(options.userId, options.conversationId);
  const pending = conversation.pendingApproval;
  if (!pending) throw new ConflictError("There is nothing waiting for approval in this conversation.");
  yield { type: "conversation", conversationId: options.conversationId, title: conversation.title };

  if (options.decision === "approve") {
    // The user may already have sent this draft from its card; then there is nothing to approve.
    const current = await getDraft(options.userId, pending.draftId);
    if (current.status !== "sent") await approveDraft(options.userId, pending.draftId, options.edits ?? {});
  }
  await setPendingApproval(options.conversationId, null);
  await appendMessage(options.conversationId, {
    role: "user",
    content: options.decision === "approve" ? "✅ Approved sending the email." : `❌ Don't send it.${options.reason ? ` ${options.reason}` : ""}`,
  });

  const resume: ApprovalDecision =
    options.decision === "approve"
      ? { action: "approve", draftId: pending.draftId }
      : { action: "reject", draftId: pending.draftId, reason: options.reason };
  yield* trackedRun(
    { userId: options.userId, conversationId: options.conversationId, signal: options.signal },
    new Command({ resume }),
    { resume: resume.action },
  );
}

/** Wraps a run in an AiTask record (type agent_run) for the activity log. */
async function* trackedRun(ctx: RunContext, input: { messages: HumanMessage[] } | Command, taskInput: unknown) {
  const task = await startAiTask({ userId: ctx.userId, conversationId: ctx.conversationId, type: "agent_run", input: taskInput });
  let toolSteps = 0;
  let paused = false;
  try {
    for await (const event of runAgent(ctx, input)) {
      if (event.type === "activity" && event.step.status === "done") toolSteps++;
      if (event.type === "approval_required") paused = true;
      yield event;
    }
    await task.succeed({ toolSteps, paused });
  } catch (err) {
    await task.fail(err);
    throw err instanceof AppError ? err : new AppError(errorMessage(err), 502, "agent_error");
  }
}
