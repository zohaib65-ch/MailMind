import "server-only";
import { Annotation, END, START, StateGraph, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { Email, EmailThread } from "@/lib/db/models";
import { randomToken } from "@/lib/utils/crypto";
import { errorMessage } from "@/lib/utils/errors";
import { createLogger } from "@/lib/utils/logger";
import {
  type ActionDecision,
  type ClassificationOutput,
  type ExtractedInformation,
  type UrgencyOutput,
} from "@/schemas/ai";
import { CATEGORY_LABELS, type EmailCategory } from "@/schemas/common";
import { setEmailImportant } from "@/services/email/email.service";
import { recordSkippedTask, trackAiTask } from "./ai-task.service";
import { toPromptEmail, type EmailContext } from "./context";
import { generateReplyDraft } from "./reply.service";
import { decideActions } from "./steps/action-decision";
import { classifyEmail } from "./steps/classifier";
import { extractInformation } from "./steps/extractor";
import { updateThreadMemory } from "./steps/memory";
import { summarizeEmail } from "./steps/summarizer";
import { detectUrgency } from "./steps/urgency";

const log = createLogger("pipeline");

/*
 * The MailMind AI pipeline, as a LangGraph workflow.
 *
 *            ┌─ (sent by the user) ─────────────────────────────────────┐
 *   START ───┤                                                          ▼
 *            └─▶ classify ─┬─▶ extract ──┐                            memory ─▶ finalize ─▶ END
 *                          │             ├─▶ assess_urgency ─▶ decide ─▶ act ─┤   ▲
 *                          └─▶ summarize ┘   (spam skips extract)      └─▶ draft
 *
 * extract and summarize run in parallel. Every node is a separate, modular step that is
 * recorded in `ai_tasks`. Nodes report progress through LangGraph's custom stream, which
 * the email page shows live while it processes. (Node names can't reuse state keys, hence
 * "assess_urgency" for the node that writes `urgency`.)
 */

export type PipelineStepEvent = {
  step: PipelineStep;
  status: "running" | "done" | "skipped" | "error";
  detail?: string;
};

export const PIPELINE_STEPS = [
  "classify",
  "extract",
  "summarize",
  "urgency",
  "decide",
  "act",
  "draft",
  "memory",
  "finalize",
] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

type UrgencyResult = Pick<UrgencyOutput, "urgency" | "reasons" | "respondBy">;

const PipelineState = Annotation.Root({
  runId: Annotation<string>(),
  ctx: Annotation<EmailContext>(),
  classification: Annotation<ClassificationOutput | undefined>(),
  extracted: Annotation<ExtractedInformation | undefined>(),
  summary: Annotation<string | undefined>(),
  urgency: Annotation<UrgencyResult | undefined>(),
  decision: Annotation<ActionDecision | undefined>(),
  draftId: Annotation<string | undefined>(),
  models: Annotation<string[]>({ reducer: (a, b) => [...new Set([...a, ...b])], default: () => [] }),
  errors: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});

type State = typeof PipelineState.State;
type Update = typeof PipelineState.Update;

const NO_MEMORY_CATEGORIES = new Set<EmailCategory>(["spam", "newsletter", "notification", "shopping"]);

function emit(config: LangGraphRunnableConfig, event: PipelineStepEvent) {
  config.writer?.(event);
}

function meta(state: State, type: Parameters<typeof trackAiTask>[0]["type"], input?: unknown) {
  return {
    userId: state.ctx.user._id.toString(),
    emailId: state.ctx.email._id.toString(),
    pipelineRunId: state.runId,
    type,
    input,
  };
}

/** A user reply later in the thread means this email has already been answered. */
function alreadyAnswered(ctx: EmailContext): boolean {
  return ctx.threadEmails.some((m) => m.direction === "outbound" && m.receivedAt > ctx.email.receivedAt);
}

// ─── Nodes ────────────────────────────────────────────────────────────────────

async function classifyNode(state: State, config: LangGraphRunnableConfig): Promise<Update> {
  emit(config, { step: "classify", status: "running" });
  // Classification is the one step everything else depends on, so a failure here fails
  // the whole run (the email is marked "failed" and can be retried).
  const result = await trackAiTask(meta(state, "classify"), async () => {
    const r = await classifyEmail(state.ctx.stepUser, toPromptEmail(state.ctx.email));
    return { result: r, output: r.data, usage: r.usage, model: r.model };
  });
  emit(config, {
    step: "classify",
    status: "done",
    detail: `${CATEGORY_LABELS[result.data.category]} · ${Math.round(result.data.confidence * 100)}% confident`,
  });
  return { classification: result.data, models: [result.model] };
}

async function extractNode(state: State, config: LangGraphRunnableConfig): Promise<Update> {
  emit(config, { step: "extract", status: "running" });
  try {
    const result = await trackAiTask(meta(state, "extract"), async () => {
      const r = await extractInformation(state.ctx.stepUser, toPromptEmail(state.ctx.email));
      return { result: r, output: { extracted: r.data, droppedAsUngrounded: r.dropped }, usage: r.usage, model: r.model };
    });
    const count = Object.values(result.data).reduce((n, list) => n + list.length, 0);
    const dropped = result.dropped.length ? ` · ${result.dropped.length} unverified dropped` : "";
    emit(config, { step: "extract", status: "done", detail: `${count} details, ${result.data.tasks.length} tasks${dropped}` });
    return { extracted: result.data, models: [result.model] };
  } catch (err) {
    emit(config, { step: "extract", status: "error", detail: errorMessage(err) });
    return { errors: [`extract: ${errorMessage(err)}`] };
  }
}

async function summarizeNode(state: State, config: LangGraphRunnableConfig): Promise<Update> {
  emit(config, { step: "summarize", status: "running" });
  try {
    const result = await trackAiTask(meta(state, "summarize", { length: "normal" }), async () => {
      const r = await summarizeEmail(state.ctx.stepUser, toPromptEmail(state.ctx.email), "normal");
      return { result: r, output: { summary: r.data }, usage: r.usage, model: r.model };
    });
    emit(config, { step: "summarize", status: "done", detail: "Summary ready" });
    return { summary: result.data, models: [result.model] };
  } catch (err) {
    emit(config, { step: "summarize", status: "error", detail: errorMessage(err) });
    return { errors: [`summarize: ${errorMessage(err)}`] };
  }
}

async function urgencyNode(state: State, config: LangGraphRunnableConfig): Promise<Update> {
  const classification = state.classification!;
  if (classification.category === "spam") {
    await recordSkippedTask(meta(state, "urgency"), "Spam is always low urgency");
    emit(config, { step: "urgency", status: "skipped", detail: "Spam → low" });
    return { urgency: { urgency: "low", reasons: ["Spam"], respondBy: null } };
  }
  emit(config, { step: "urgency", status: "running" });
  try {
    const result = await trackAiTask(meta(state, "urgency"), async () => {
      const r = await detectUrgency(state.ctx.stepUser, toPromptEmail(state.ctx.email), {
        category: classification.category,
        needsReply: classification.needsReply,
        deadlines: state.extracted?.deadlines ?? [],
      });
      return { result: r, output: r.data, usage: r.usage, model: r.model };
    });
    emit(config, { step: "urgency", status: "done", detail: `${result.data.urgency} urgency` });
    return { urgency: result.data, models: [result.model] };
  } catch (err) {
    emit(config, { step: "urgency", status: "error", detail: errorMessage(err) });
    return { urgency: { urgency: "medium", reasons: [], respondBy: null }, errors: [`urgency: ${errorMessage(err)}`] };
  }
}

async function decideNode(state: State, config: LangGraphRunnableConfig): Promise<Update> {
  const settings = state.ctx.user.settings;
  const answered = alreadyAnswered(state.ctx);
  const decision = await trackAiTask(meta(state, "action_decision"), async () => {
    const d = decideActions({
      classification: answered ? { ...state.classification!, needsReply: false } : state.classification!,
      urgency: state.urgency!,
      extracted: state.extracted,
      alreadyImportant: state.ctx.email.isImportant,
      policy: { autoDraftReplies: settings?.autoDraftReplies ?? true, autoMarkImportant: settings?.autoMarkImportant ?? true },
    });
    return { result: d };
  });
  const auto = decision.actions.filter((a) => a.automatic).map((a) => a.type.replace("_", " "));
  emit(config, { step: "decide", status: "done", detail: auto.length ? `Will ${auto.join(", ")}` : "No automatic actions" });
  return { decision };
}

/** Executes automatic, reversible actions through the same service calls the UI uses. */
async function actNode(state: State, config: LangGraphRunnableConfig): Promise<Update> {
  const markImportant = state.decision?.actions.find((a) => a.type === "mark_important" && a.automatic);
  if (!markImportant) {
    emit(config, { step: "act", status: "skipped" });
    return {};
  }
  try {
    await setEmailImportant(state.ctx.user._id.toString(), state.ctx.email._id.toString(), true);
    emit(config, { step: "act", status: "done", detail: "Marked as important" });
    return {};
  } catch (err) {
    emit(config, { step: "act", status: "error", detail: errorMessage(err) });
    return { errors: [`act: ${errorMessage(err)}`] };
  }
}

async function draftNode(state: State, config: LangGraphRunnableConfig): Promise<Update> {
  emit(config, { step: "draft", status: "running" });
  try {
    const draft = await generateReplyDraft({
      userId: state.ctx.user._id.toString(),
      emailId: state.ctx.email._id.toString(),
      source: "pipeline",
      pipelineRunId: state.runId,
      context: state.ctx,
    });
    emit(config, { step: "draft", status: "done", detail: "Reply drafted — waiting for your review" });
    return { draftId: draft.id, models: draft.model ? [draft.model] : [] };
  } catch (err) {
    emit(config, { step: "draft", status: "error", detail: errorMessage(err) });
    return { errors: [`draft: ${errorMessage(err)}`] };
  }
}

async function memoryNode(state: State, config: LangGraphRunnableConfig): Promise<Update> {
  const { ctx } = state;
  const category = state.classification?.category;
  if (ctx.email.direction === "inbound" && category && NO_MEMORY_CATEGORIES.has(category)) {
    emit(config, { step: "memory", status: "skipped", detail: "Automated email" });
    return {};
  }
  // Memory is built in conversation order. If a newer message is already folded in, don't
  // fold an older one in on top of it (e.g. when re-processing an old email).
  const last = ctx.thread.memory?.lastEmailId
    ? ctx.threadEmails.find((m) => m._id.equals(ctx.thread.memory!.lastEmailId!))
    : undefined;
  if (last && last.receivedAt >= ctx.email.receivedAt) {
    emit(config, { step: "memory", status: "skipped", detail: "Already remembered" });
    return {};
  }
  emit(config, { step: "memory", status: "running" });
  try {
    const result = await trackAiTask(meta(state, "memory_update"), async () => {
      const r = await updateThreadMemory(ctx.stepUser, ctx.thread.memory, toPromptEmail(ctx.email), ctx.email.direction);
      return { result: r, output: r.data, usage: r.usage, model: r.model };
    });
    await EmailThread.updateOne(
      { _id: ctx.thread._id },
      { $set: { memory: { ...result.data, lastEmailId: ctx.email._id, updatedAt: new Date() } } },
    );
    emit(config, { step: "memory", status: "done", detail: "Conversation memory updated" });
    return { models: [result.model] };
  } catch (err) {
    emit(config, { step: "memory", status: "error", detail: errorMessage(err) });
    return { errors: [`memory: ${errorMessage(err)}`] };
  }
}

async function finalizeNode(state: State, config: LangGraphRunnableConfig): Promise<Update> {
  const { ctx, classification, urgency, extracted, summary, decision } = state;
  const set: Record<string, unknown> = {
    "ai.status": "processed",
    "ai.processedAt": new Date(),
    "ai.pipelineRunId": state.runId,
    "ai.model": state.models.join(", ") || undefined,
    "ai.error": state.errors.length ? `Some steps failed: ${state.errors.join(" | ")}` : null,
  };
  if (classification) {
    Object.assign(set, {
      "ai.category": classification.category,
      "ai.categoryReason": classification.reason,
      "ai.confidence": classification.confidence,
      "ai.needsReply": classification.needsReply,
    });
  }
  if (urgency) Object.assign(set, { "ai.urgency": urgency.urgency, "ai.urgencyReasons": urgency.reasons, "ai.respondBy": urgency.respondBy });
  if (extracted) set["ai.extracted"] = extracted;
  if (summary) set["ai.summary"] = summary;
  if (decision) set["ai.actions"] = decision.actions;

  await Email.updateOne({ _id: ctx.email._id }, { $set: set });

  if (ctx.email.direction === "inbound" && classification) {
    if (alreadyAnswered(ctx)) {
      await Email.updateOne({ _id: ctx.email._id }, { $set: { replyStatus: "replied" } });
    } else if (classification.needsReply) {
      // Don't overwrite "drafted" (set when the draft was created) or "replied".
      await Email.updateOne({ _id: ctx.email._id, replyStatus: "none" }, { $set: { replyStatus: "needs_reply" } });
    }
  }
  emit(config, { step: "finalize", status: "done", detail: state.errors.length ? "Done, with some errors" : "Done" });
  return {};
}

// ─── Routing ──────────────────────────────────────────────────────────────────

function routeStart(state: State): "classify" | "memory" {
  return state.ctx.email.direction === "outbound" ? "memory" : "classify";
}

function routeAfterClassify(state: State): ("extract" | "summarize")[] {
  const c = state.classification!;
  // Extracting tasks and links from spam is wasted tokens (and could surface scam links).
  return c.category === "spam" && c.confidence >= 0.7 ? ["summarize"] : ["extract", "summarize"];
}

function routeAfterAct(state: State): "draft" | "memory" {
  return state.decision?.actions.some((a) => a.type === "draft_reply" && a.automatic) ? "draft" : "memory";
}

const graph = new StateGraph(PipelineState)
  .addNode("classify", classifyNode)
  .addNode("extract", extractNode)
  .addNode("summarize", summarizeNode)
  .addNode("assess_urgency", urgencyNode)
  .addNode("decide", decideNode)
  .addNode("act", actNode)
  .addNode("draft", draftNode)
  .addNode("memory", memoryNode)
  .addNode("finalize", finalizeNode)
  .addConditionalEdges(START, routeStart, ["classify", "memory"])
  .addConditionalEdges("classify", routeAfterClassify, ["extract", "summarize"])
  .addEdge("extract", "assess_urgency")
  .addEdge("summarize", "assess_urgency")
  .addEdge("assess_urgency", "decide")
  .addEdge("decide", "act")
  .addConditionalEdges("act", routeAfterAct, ["draft", "memory"])
  .addEdge("draft", "memory")
  .addEdge("memory", "finalize")
  .addEdge("finalize", END)
  .compile({ name: "mailmind_email_pipeline" });

export type PipelineResult = {
  runId: string;
  category?: EmailCategory;
  urgency?: string;
  draftId?: string;
  errors: string[];
};

/** Runs the whole pipeline for one email. `onStep` receives live progress events. */
export async function runEmailPipeline(
  ctx: EmailContext,
  onStep?: (event: PipelineStepEvent) => void,
): Promise<PipelineResult> {
  const runId = `run_${randomToken(9)}`;
  log.info("Pipeline started", { runId, emailId: ctx.email._id.toString() });
  let final: State | undefined;
  const stream = await graph.stream({ runId, ctx }, { streamMode: ["custom", "values"], runName: "email_pipeline" });
  for await (const [mode, chunk] of stream) {
    if (mode === "custom") onStep?.(chunk as PipelineStepEvent);
    else final = chunk as State;
  }
  log.info("Pipeline finished", { runId, errors: final?.errors.length ?? 0 });
  return {
    runId,
    category: final?.classification?.category,
    urgency: final?.urgency?.urgency,
    draftId: final?.draftId,
    errors: final?.errors ?? [],
  };
}
