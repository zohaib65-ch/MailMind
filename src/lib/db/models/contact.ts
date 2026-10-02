import { Schema } from "mongoose";
import { CONTACT_RELATIONSHIPS, type ContactRelationship } from "@/schemas/common";
import { defineModel, type ObjectId } from "./shared";

/**
 * People the user exchanges email with. `relationship` is a label the user sets
 * (manager, client, …) to organise their contacts.
 */
export interface IContact {
  _id: ObjectId;
  userId: ObjectId;
  email: string;
  name?: string;
  company?: string;
  relationship: ContactRelationship;
  emailCount: number;
  lastEmailAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    company: { type: String, trim: true },
    relationship: { type: String, enum: CONTACT_RELATIONSHIPS, default: "unknown" },
    emailCount: { type: Number, default: 0 },
    lastEmailAt: Date,
  },
  { timestamps: true },
);

contactSchema.index({ userId: 1, email: 1 }, { unique: true });
contactSchema.index({ userId: 1, relationship: 1 });
contactSchema.index({ userId: 1, lastEmailAt: -1 });

export const Contact = defineModel<IContact>("Contact", contactSchema);
