import { Schema } from "mongoose";
import { EMAIL_PROVIDERS, type EmailProviderName } from "@/schemas/common";
import { defineModel, type ObjectId } from "./shared";

export interface IEmailAccount {
  _id: ObjectId;
  userId: ObjectId;
  provider: EmailProviderName;
  emailAddress: string;
  displayName?: string;
  /**
   * OAuth credentials, encrypted with AES-256-GCM (lib/utils/crypto.ts).
   * `select: false` keeps them out of every query unless explicitly requested.
   */
  auth?: {
    accessTokenEnc?: string;
    refreshTokenEnc?: string;
    expiresAt?: Date;
    scope?: string;
  };
  sync: {
    lastSyncedAt?: Date;
    /** Gmail history id for incremental sync. */
    historyId?: string;
    error?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const emailAccountSchema = new Schema<IEmailAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: EMAIL_PROVIDERS, required: true },
    emailAddress: { type: String, required: true, lowercase: true, trim: true },
    displayName: String,
    auth: {
      type: {
        accessTokenEnc: String,
        refreshTokenEnc: String,
        expiresAt: Date,
        scope: String,
      },
      select: false,
    },
    sync: {
      lastSyncedAt: Date,
      historyId: String,
      error: String,
    },
  },
  { timestamps: true },
);

emailAccountSchema.index({ userId: 1, provider: 1, emailAddress: 1 }, { unique: true });

export const EmailAccount = defineModel<IEmailAccount>("EmailAccount", emailAccountSchema);
