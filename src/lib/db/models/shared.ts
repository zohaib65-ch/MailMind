import { Schema, model, models, type Model, type Types } from "mongoose";

export type ObjectId = Types.ObjectId;

/** Reuse the compiled model across Next.js hot reloads instead of re-registering it. */
export function defineModel<T>(name: string, schema: Schema<T>, collection?: string): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema, collection);
}

export interface Address {
  name?: string;
  email: string;
}

export const addressSchema = new Schema<Address>(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
  },
  { _id: false },
);

/** AI audit records are kept for 90 days; MongoDB's TTL monitor deletes older ones. */
export const AUDIT_TTL_SECONDS = 60 * 60 * 24 * 90;
