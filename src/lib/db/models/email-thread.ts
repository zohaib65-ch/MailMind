import { Schema } from "mongoose";
import { addressSchema, defineModel, type Address, type ObjectId } from "./shared";

export interface Commitment {
  by: "user" | "contact";
  text: string;
  due: string | null;
}

/**
 * Compact, AI-maintained memory of a conversation: what was discussed and what was
 * promised. Reply drafting reads this instead of re-sending the whole thread to the LLM.
 * Embedded in the thread because it is always read together with it (1:1).
 */
export interface ThreadMemory {
  summary: string;
  facts: string[];
  commitments: Commitment[];
  openQuestions: string[];
  lastEmailId?: ObjectId;
  updatedAt: Date;
}

export interface IEmailThread {
  _id: ObjectId;
  userId: ObjectId;
  accountId: ObjectId;
  providerThreadId: string;
  subject: string;
  lastMessageAt: Date;
  messageCount: number;
  participants: Address[];
  memory?: ThreadMemory;
  createdAt: Date;
  updatedAt: Date;
}

const threadSchema = new Schema<IEmailThread>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "EmailAccount", required: true },
    providerThreadId: { type: String, required: true },
    subject: { type: String, default: "" },
    lastMessageAt: { type: Date, required: true },
    messageCount: { type: Number, default: 0 },
    participants: { type: [addressSchema], default: [] },
    memory: {
      type: new Schema<ThreadMemory>(
        {
          summary: { type: String, required: true },
          facts: [String],
          commitments: [
            new Schema<Commitment>(
              { by: { type: String, enum: ["user", "contact"] }, text: String, due: { type: String, default: null } },
              { _id: false },
            ),
          ],
          openQuestions: [String],
          lastEmailId: { type: Schema.Types.ObjectId, ref: "Email" },
          updatedAt: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
      required: false,
    },
  },
  { timestamps: true },
);

threadSchema.index({ accountId: 1, providerThreadId: 1 }, { unique: true });
threadSchema.index({ userId: 1, lastMessageAt: -1 });

export const EmailThread = defineModel<IEmailThread>("EmailThread", threadSchema, "email_threads");
