import { Schema } from "mongoose";
import { AUDIT_TTL_SECONDS, defineModel, type ObjectId } from "./shared";

export const AI_TASK_TYPES = [
  "pipeline",
  "classify",
  "extract",
  "summarize",
  "urgency",
  "action_decision",
  "draft_reply",
  "memory_update",
] as const;
export type AiTaskType = (typeof AI_TASK_TYPES)[number];

export const AI_TASK_STATUSES = ["running", "succeeded", "failed", "skipped"] as const;
export type AiTaskStatus = (typeof AI_TASK_STATUSES)[number];

/** One document per AI step — an audit trail of what the AI did, with tokens and latency. */
export interface IAiTask {
  _id: ObjectId;
  userId: ObjectId;
  emailId?: ObjectId;
  pipelineRunId?: string;
  type: AiTaskType;
  status: AiTaskStatus;
  model?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  startedAt: Date;
  finishedAt?: Date;
}

const aiTaskSchema = new Schema<IAiTask>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  emailId: { type: Schema.Types.ObjectId, ref: "Email" },
  pipelineRunId: String,
  type: { type: String, enum: AI_TASK_TYPES, required: true },
  status: { type: String, enum: AI_TASK_STATUSES, default: "running" },
  model: String,
  input: Schema.Types.Mixed,
  output: Schema.Types.Mixed,
  error: String,
  inputTokens: Number,
  outputTokens: Number,
  latencyMs: Number,
  startedAt: { type: Date, default: Date.now },
  finishedAt: Date,
});

aiTaskSchema.index({ userId: 1, startedAt: -1 });
aiTaskSchema.index({ emailId: 1, startedAt: -1 });
aiTaskSchema.index({ pipelineRunId: 1 });
aiTaskSchema.index({ startedAt: 1 }, { expireAfterSeconds: AUDIT_TTL_SECONDS });

export const AiTask = defineModel<IAiTask>("AiTask", aiTaskSchema, "ai_tasks");
