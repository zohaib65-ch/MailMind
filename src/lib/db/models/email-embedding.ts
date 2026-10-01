import { Schema } from "mongoose";
import { defineModel, type ObjectId } from "./shared";

/**
 * One document per text chunk of an email, with its embedding vector.
 *
 * Semantic search runs Atlas Vector Search (`$vectorSearch`) over the `embedding` field.
 * The vector index is an Atlas Search index, not a regular MongoDB index, so it is created
 * by `npm run db:indexes` (see lib/vector/atlas-vector.ts) rather than declared here.
 */
export interface IEmailEmbedding {
  _id: ObjectId;
  userId: ObjectId;
  emailId: ObjectId;
  chunkIndex: number;
  content: string;
  contentHash: string;
  model: string;
  dimensions: number;
  embedding: number[];
  createdAt: Date;
}

const embeddingSchema = new Schema<IEmailEmbedding>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emailId: { type: Schema.Types.ObjectId, ref: "Email", required: true },
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    contentHash: { type: String, required: true },
    model: { type: String, required: true },
    dimensions: { type: Number, required: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

embeddingSchema.index({ emailId: 1, model: 1, chunkIndex: 1 }, { unique: true });
embeddingSchema.index({ userId: 1, model: 1 });

export const EmailEmbedding = defineModel<IEmailEmbedding>("EmailEmbedding", embeddingSchema, "email_embeddings");
