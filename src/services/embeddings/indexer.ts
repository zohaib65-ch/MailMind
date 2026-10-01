import "server-only";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { connectDb, toObjectId } from "@/lib/db/mongoose";
import { Email, EmailEmbedding, type IEmail } from "@/lib/db/models";
import { acquireLock } from "@/lib/utils/cache";
import { sha256 } from "@/lib/utils/crypto";
import { stripQuotedReply } from "@/lib/utils/email-text";
import { errorMessage } from "@/lib/utils/errors";
import { createLogger } from "@/lib/utils/logger";
import { getEmbeddingsConfig } from "./providers";

const log = createLogger("embeddings");

const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1_200, chunkOverlap: 150 });

/**
 * Splits an email into chunks for embedding. Each chunk is prefixed with the subject,
 * sender and date — "contextual chunk headers" — so a chunk from the middle of a long
 * email still carries what it is about.
 */
export async function chunkEmail(email: Pick<IEmail, "subject" | "from" | "receivedAt" | "bodyText">): Promise<string[]> {
  const header = `Subject: ${email.subject}\nFrom: ${email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email}\nDate: ${email.receivedAt.toISOString().slice(0, 10)}`;
  const body = stripQuotedReply(email.bodyText) || email.bodyText;
  const pieces = body.trim() ? await splitter.splitText(body) : [""];
  return pieces.slice(0, 20).map((piece) => `${header}\n\n${piece}`.trim());
}

/** (Re)indexes one email. Unchanged chunks are skipped, so re-running is cheap. */
export async function indexEmail(email: IEmail): Promise<number> {
  const { embeddings, model, dimensions } = getEmbeddingsConfig();
  const chunks = await chunkEmail(email);
  const hashes = chunks.map((c) => sha256(c));

  const existing = await EmailEmbedding.find({ emailId: email._id, model }).select("chunkIndex contentHash").lean();
  const unchanged =
    existing.length === chunks.length && existing.every((e) => hashes[e.chunkIndex] === e.contentHash);
  if (!unchanged) {
    const vectors = await embeddings.embedDocuments(chunks);
    await EmailEmbedding.deleteMany({ emailId: email._id, model });
    await EmailEmbedding.insertMany(
      chunks.map((content, chunkIndex) => ({
        userId: email.userId,
        emailId: email._id,
        chunkIndex,
        content,
        contentHash: hashes[chunkIndex],
        model,
        dimensions,
        embedding: vectors[chunkIndex],
      })),
    );
  }
  await Email.updateOne(
    { _id: email._id },
    { $set: { embedding: { model, chunkCount: chunks.length, indexedAt: new Date() } } },
  );
  return chunks.length;
}

/**
 * Indexes every email that is not yet embedded with the current model. Embedding does not
 * need the LLM, so semantic search works even before the AI pipeline has run.
 */
export async function indexPendingEmails(userId: string, options: { limit?: number } = {}) {
  await connectDb();
  const release = await acquireLock(`embed:${userId}`, 15 * 60);
  if (!release) return { indexed: 0, failed: 0, skipped: true };
  const { model } = getEmbeddingsConfig();
  let indexed = 0;
  let failed = 0;
  try {
    const emails = (await Email.find({ userId: toObjectId(userId), "embedding.model": { $ne: model } })
      .sort({ receivedAt: -1 })
      .limit(options.limit ?? 500)
      .lean()) as IEmail[];
    for (const email of emails) {
      try {
        await indexEmail(email);
        indexed++;
      } catch (err) {
        failed++;
        log.warn("Failed to index email", { emailId: email._id.toString(), error: errorMessage(err) });
      }
    }
    if (indexed) log.info("Indexed emails", { userId, indexed, model });
    return { indexed, failed, skipped: false };
  } finally {
    await release();
  }
}

export async function getIndexStatus(userId: string) {
  await connectDb();
  const { model, provider, dimensions } = getEmbeddingsConfig();
  const [total, indexed, chunks] = await Promise.all([
    Email.countDocuments({ userId: toObjectId(userId) }),
    Email.countDocuments({ userId: toObjectId(userId), "embedding.model": model }),
    EmailEmbedding.countDocuments({ userId: toObjectId(userId), model }),
  ]);
  return { provider, model, dimensions, total, indexed, chunks };
}
