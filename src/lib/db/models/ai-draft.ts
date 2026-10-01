import { Schema } from "mongoose";
import { DRAFT_SOURCES, DRAFT_STATUSES, type DraftSource, type DraftStatus } from "@/schemas/common";
import { addressSchema, defineModel, type Address, type ObjectId } from "./shared";

/**
 * A reply prepared by the AI (or the user). Nothing is sent until the user approves it:
 *
 *   pending_review ──(user clicks Send / approves in chat)──▶ approved ──▶ sending ──▶ sent
 *          └──▶ discarded                                                    └──▶ failed
 */
export interface IAiDraft {
  _id: ObjectId;
  userId: ObjectId;
  accountId: ObjectId;
  emailId?: ObjectId;
  threadId?: ObjectId;
  to: Address[];
  cc: Address[];
  subject: string;
  body: string;
  /** The body exactly as the AI wrote it, so edits can be compared later. */
  originalBody?: string;
  status: DraftStatus;
  source: DraftSource;
  notes: string[];
  model?: string;
  conversationId?: ObjectId;
  approvedAt?: Date;
  sentAt?: Date;
  sentProviderMessageId?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const draftSchema = new Schema<IAiDraft>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "EmailAccount", required: true },
    emailId: { type: Schema.Types.ObjectId, ref: "Email" },
    threadId: { type: Schema.Types.ObjectId, ref: "EmailThread" },
    to: { type: [addressSchema], default: [] },
    cc: { type: [addressSchema], default: [] },
    subject: { type: String, required: true, maxlength: 500 },
    body: { type: String, required: true, maxlength: 50_000 },
    originalBody: String,
    status: { type: String, enum: DRAFT_STATUSES, default: "pending_review" },
    source: { type: String, enum: DRAFT_SOURCES, required: true },
    notes: { type: [String], default: [] },
    model: String,
    conversationId: { type: Schema.Types.ObjectId, ref: "AiConversation" },
    approvedAt: Date,
    sentAt: Date,
    sentProviderMessageId: String,
    error: String,
  },
  { timestamps: true },
);

draftSchema.index({ userId: 1, status: 1, updatedAt: -1 });
draftSchema.index({ emailId: 1 });

export const AiDraft = defineModel<IAiDraft>("AiDraft", draftSchema, "ai_drafts");
