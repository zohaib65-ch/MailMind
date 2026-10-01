import { Schema } from "mongoose";
import { AUDIT_TTL_SECONDS, defineModel, type ObjectId } from "./shared";

export const TOOL_EXECUTION_STATUSES = ["running", "succeeded", "failed", "awaiting_approval", "rejected"] as const;
export type ToolExecutionStatus = (typeof TOOL_EXECUTION_STATUSES)[number];

/** One document per tool call made by the agent or the pipeline. */
export interface IToolExecution {
  _id: ObjectId;
  userId: ObjectId;
  source: "agent" | "pipeline";
  conversationId?: ObjectId;
  emailId?: ObjectId;
  toolName: string;
  toolCallId: string;
  input: unknown;
  output?: unknown;
  /** Safe one-line description shown in the activity feed, e.g. "Found 8 emails". */
  summary?: string;
  status: ToolExecutionStatus;
  error?: string;
  latencyMs?: number;
  startedAt: Date;
  finishedAt?: Date;
}

const toolExecutionSchema = new Schema<IToolExecution>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  source: { type: String, enum: ["agent", "pipeline"], required: true },
  conversationId: { type: Schema.Types.ObjectId, ref: "AiConversation" },
  emailId: { type: Schema.Types.ObjectId, ref: "Email" },
  toolName: { type: String, required: true },
  toolCallId: { type: String, required: true },
  input: Schema.Types.Mixed,
  output: Schema.Types.Mixed,
  summary: String,
  status: { type: String, enum: TOOL_EXECUTION_STATUSES, default: "running" },
  error: String,
  latencyMs: Number,
  startedAt: { type: Date, default: Date.now },
  finishedAt: Date,
});

// A tool call that pauses for approval runs again on resume; upserting on the call id
// keeps it as one record instead of two.
toolExecutionSchema.index({ userId: 1, toolCallId: 1 }, { unique: true });
toolExecutionSchema.index({ userId: 1, startedAt: -1 });
toolExecutionSchema.index({ conversationId: 1, startedAt: 1 });
toolExecutionSchema.index({ startedAt: 1 }, { expireAfterSeconds: AUDIT_TTL_SECONDS });

export const ToolExecution = defineModel<IToolExecution>("ToolExecution", toolExecutionSchema, "tool_executions");
