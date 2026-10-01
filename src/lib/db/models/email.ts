import { Schema } from "mongoose";
import {
  AI_STATUSES,
  EMAIL_CATEGORIES,
  REPLY_STATUSES,
  URGENCY_LEVELS,
  type AiStatus,
  type EmailCategory,
  type ReplyStatus,
  type Urgency,
} from "@/schemas/common";
import type { ActionDecision, ExtractedInformation } from "@/schemas/ai";
import { addressSchema, defineModel, type Address, type ObjectId } from "./shared";

/** Everything the AI pipeline learned about an email. Embedded: it is read with the email. */
export interface EmailAi {
  status: AiStatus;
  error?: string;
  claimedAt?: Date;
  processedAt?: Date;
  pipelineRunId?: string;
  model?: string;
  category?: EmailCategory;
  categoryReason?: string;
  confidence?: number;
  urgency?: Urgency;
  urgencyReasons: string[];
  respondBy?: string | null;
  needsReply: boolean;
  summary?: string;
  summaryShort?: string;
  summaryDetailed?: string;
  extracted?: ExtractedInformation;
  actions: ActionDecision["actions"];
}

export interface IEmail {
  _id: ObjectId;
  userId: ObjectId;
  accountId: ObjectId;
  threadId: ObjectId;
  providerMessageId: string;
  providerThreadId: string;
  messageIdHeader?: string;
  inReplyTo?: string;
  references: string[];
  direction: "inbound" | "outbound";
  from: Address;
  to: Address[];
  cc: Address[];
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: Date;
  /** Provider labels (Gmail labels / mock folders), stored by name. */
  labels: string[];
  isRead: boolean;
  isArchived: boolean;
  isImportant: boolean;
  replyStatus: ReplyStatus;
  ai: EmailAi;
  /** Semantic-search indexing state (chunks live in the email_embeddings collection). */
  embedding?: { model: string; chunkCount: number; indexedAt: Date };
  createdAt: Date;
  updatedAt: Date;
}

const extractedSchema = new Schema<ExtractedInformation>(
  {
    people: [String],
    companies: [String],
    dates: [String],
    times: [String],
    phoneNumbers: [String],
    links: [String],
    tasks: [String],
    deadlines: [String],
  },
  { _id: false },
);

const aiSchema = new Schema<EmailAi>(
  {
    status: { type: String, enum: AI_STATUSES, default: "pending" },
    error: String,
    claimedAt: Date,
    processedAt: Date,
    pipelineRunId: String,
    model: String,
    category: { type: String, enum: EMAIL_CATEGORIES },
    categoryReason: String,
    confidence: Number,
    urgency: { type: String, enum: URGENCY_LEVELS },
    urgencyReasons: { type: [String], default: [] },
    respondBy: { type: String, default: null },
    needsReply: { type: Boolean, default: false },
    summary: String,
    summaryShort: String,
    summaryDetailed: String,
    extracted: extractedSchema,
    actions: {
      type: [new Schema({ type: String, reason: String, automatic: Boolean }, { _id: false })],
      default: [],
    },
  },
  { _id: false },
);

const emailSchema = new Schema<IEmail>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "EmailAccount", required: true },
    threadId: { type: Schema.Types.ObjectId, ref: "EmailThread", required: true },
    providerMessageId: { type: String, required: true },
    providerThreadId: { type: String, required: true },
    messageIdHeader: String,
    inReplyTo: String,
    references: { type: [String], default: [] },
    direction: { type: String, enum: ["inbound", "outbound"], default: "inbound" },
    from: { type: addressSchema, required: true },
    to: { type: [addressSchema], default: [] },
    cc: { type: [addressSchema], default: [] },
    subject: { type: String, default: "" },
    snippet: { type: String, default: "" },
    bodyText: { type: String, default: "" },
    receivedAt: { type: Date, required: true },
    labels: { type: [String], default: [] },
    isRead: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    isImportant: { type: Boolean, default: false },
    replyStatus: { type: String, enum: REPLY_STATUSES, default: "none" },
    ai: { type: aiSchema, default: () => ({}) },
    embedding: {
      type: new Schema({ model: String, chunkCount: Number, indexedAt: Date }, { _id: false }),
      required: false,
    },
  },
  { timestamps: true },
);

emailSchema.index({ accountId: 1, providerMessageId: 1 }, { unique: true });
emailSchema.index({ userId: 1, isArchived: 1, receivedAt: -1 });
emailSchema.index({ userId: 1, "ai.category": 1, receivedAt: -1 });
emailSchema.index({ userId: 1, "ai.status": 1, receivedAt: 1 });
emailSchema.index({ userId: 1, "from.email": 1, receivedAt: -1 });
emailSchema.index({ threadId: 1, receivedAt: 1 });
// Keyword search. One text index per collection; weights favour subject and sender.
emailSchema.index(
  { subject: "text", bodyText: "text", "from.name": "text", "from.email": "text" },
  { name: "email_text", weights: { subject: 5, "from.name": 3, "from.email": 3, bodyText: 1 } },
);

export const Email = defineModel<IEmail>("Email", emailSchema);
