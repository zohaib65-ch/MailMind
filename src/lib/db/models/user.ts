import { Schema } from "mongoose";
import { SUMMARY_LENGTHS, type SummaryLength } from "@/schemas/common";
import { defineModel, type ObjectId } from "./shared";

export interface UserSettings {
  replyTone: string;
  signature?: string;
  summaryLength: SummaryLength;
  autoDraftReplies: boolean;
  autoMarkImportant: boolean;
}

/** Long-term memory: facts the assistant was asked to remember across conversations. */
export interface UserMemory {
  _id: ObjectId;
  text: string;
  createdAt: Date;
}

export interface IUser {
  _id: ObjectId;
  email: string;
  name?: string;
  settings: UserSettings;
  memories: UserMemory[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    settings: {
      replyTone: { type: String, default: "professional and friendly", maxlength: 200 },
      signature: { type: String, maxlength: 500 },
      summaryLength: { type: String, enum: SUMMARY_LENGTHS, default: "normal" },
      autoDraftReplies: { type: Boolean, default: true },
      autoMarkImportant: { type: Boolean, default: true },
    },
    memories: [
      {
        text: { type: String, required: true, maxlength: 500 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

export const User = defineModel<IUser>("User", userSchema);
