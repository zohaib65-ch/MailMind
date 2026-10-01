import { Schema } from "mongoose";
import type { ActivityStep, SendApprovalRequest } from "@/types/agent";
import { defineModel, type ObjectId } from "./shared";

export interface ConversationMessage {
  _id: ObjectId;
  role: "user" | "assistant";
  content: string;
  activity: ActivityStep[];
  draftIds: ObjectId[];
  createdAt: Date;
}

/**
 * The assistant chat as shown in the UI. The LLM-facing state (messages, tool calls,
 * thinking blocks) is stored separately by the LangGraph MongoDB checkpointer, keyed by
 * this conversation's id — see services/agent/checkpointer.ts.
 */
export interface IAiConversation {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  /** Set while the agent is paused, waiting for the user to approve sending an email. */
  pendingApproval?: SendApprovalRequest | null;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IAiConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, maxlength: 200 },
    pendingApproval: { type: Schema.Types.Mixed, default: null },
    messages: [
      {
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, default: "" },
        activity: { type: [Schema.Types.Mixed], default: [] },
        draftIds: { type: [Schema.Types.ObjectId], default: [] },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

conversationSchema.index({ userId: 1, updatedAt: -1 });

export const AiConversation = defineModel<IAiConversation>("AiConversation", conversationSchema, "ai_conversations");
