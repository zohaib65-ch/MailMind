import { Schema } from "mongoose";
import { defineModel, type ObjectId } from "./shared";

/** Server-side session. The cookie holds a random token; only its SHA-256 hash is stored. */
export interface ISession {
  _id: ObjectId;
  tokenHash: string;
  userId: ObjectId;
  expiresAt: Date;
  userAgent?: string;
  createdAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// TTL index: MongoDB deletes the session document once expiresAt has passed.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = defineModel<ISession>("Session", sessionSchema);
