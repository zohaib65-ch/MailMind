import "server-only";
import { connectDb, toObjectId } from "@/lib/db/mongoose";
import { Email, EmailAccount, EmailThread, type IEmailAccount } from "@/lib/db/models";
import { acquireLock } from "@/lib/utils/cache";
import { ConflictError, errorMessage, ValidationError } from "@/lib/utils/errors";
import { createLogger } from "@/lib/utils/logger";
import { recordContacts } from "./contact.service";
import { MOCK_INCOMING } from "./mock/fixtures";
import { parseProviderMessage, type ParsedEmail } from "./parser";
import { getProviderForAccount } from "./providers";
import { fixtureToProviderMessage } from "./providers/mock";

const log = createLogger("sync");

export type SyncResult = { accountId: string; fetched: number; created: number; createdEmailIds: string[] };

/**
 * Stores one parsed email: upserts its thread, inserts the email (idempotent on the
 * provider message id), and updates contacts. Returns whether it was new.
 */
export async function storeParsedEmail(
  account: Pick<IEmailAccount, "_id" | "userId" | "emailAddress" | "provider">,
  parsed: ParsedEmail,
): Promise<{ emailId: string; created: boolean }> {
  const thread = await EmailThread.findOneAndUpdate(
    { accountId: account._id, providerThreadId: parsed.providerThreadId },
    {
      $setOnInsert: {
        userId: account.userId,
        subject: parsed.subject.replace(/^(re|fwd?):\s*/i, ""),
        participants: [parsed.from, ...parsed.to].slice(0, 20),
      },
      $max: { lastMessageAt: parsed.receivedAt },
    },
    { upsert: true, returnDocument: "after" },
  );

  // Mailbox state (read/archived/starred) comes from the provider for real accounts. The
  // mock inbox has no state of its own, so re-syncing it must not undo the user's changes.
  const providerState =
    account.provider === "mock"
      ? {}
      : { labels: parsed.labels, isRead: parsed.isRead, isImportant: parsed.isImportant, isArchived: parsed.isArchived };

  const result = await Email.updateOne(
    { accountId: account._id, providerMessageId: parsed.providerMessageId },
    {
      $setOnInsert: {
        userId: account.userId,
        threadId: thread._id,
        providerThreadId: parsed.providerThreadId,
        messageIdHeader: parsed.messageIdHeader,
        inReplyTo: parsed.inReplyTo,
        references: parsed.references,
        direction: parsed.direction,
        from: parsed.from,
        to: parsed.to,
        cc: parsed.cc,
        subject: parsed.subject,
        snippet: parsed.snippet,
        bodyText: parsed.bodyText,
        receivedAt: parsed.receivedAt,
        replyStatus: "none",
        ai: { status: "pending", urgencyReasons: [], needsReply: false, actions: [] },
        ...(account.provider === "mock"
          ? { labels: parsed.labels, isRead: parsed.isRead, isImportant: parsed.isImportant, isArchived: parsed.isArchived }
          : {}),
      },
      ...(account.provider === "mock" ? {} : { $set: providerState }),
    },
    { upsert: true },
  );

  const created = result.upsertedCount > 0;
  const emailId = created
    ? result.upsertedId!.toString()
    : (await Email.findOne({ accountId: account._id, providerMessageId: parsed.providerMessageId }).select("_id").lean())!._id.toString();

  if (created) {
    const messageCount = await Email.countDocuments({ threadId: thread._id });
    await EmailThread.updateOne({ _id: thread._id }, { $set: { messageCount } });

    const correspondents = parsed.direction === "inbound" ? [parsed.from, ...parsed.cc] : [...parsed.to, ...parsed.cc];
    await recordContacts(account.userId.toString(), correspondents, parsed.receivedAt, account.emailAddress);

    // A message the user sent answers the earlier inbound messages in the same thread.
    if (parsed.direction === "outbound") {
      await Email.updateMany(
        {
          threadId: thread._id,
          direction: "inbound",
          receivedAt: { $lt: parsed.receivedAt },
          replyStatus: { $in: ["needs_reply", "drafted"] },
        },
        { $set: { replyStatus: "replied" } },
      );
    }
  }
  return { emailId, created };
}

export async function syncAccount(accountId: string, options: { maxMessages?: number } = {}): Promise<SyncResult> {
  await connectDb();
  const release = await acquireLock(`sync:${accountId}`, 300);
  if (!release) throw new ConflictError("A sync is already running for this account");

  const account = await EmailAccount.findById(accountId).lean();
  if (!account) {
    await release();
    throw new ValidationError("Unknown email account");
  }

  const maxMessages = options.maxMessages ?? 200;
  const result: SyncResult = { accountId, fetched: 0, created: 0, createdEmailIds: [] };
  try {
    const provider = await getProviderForAccount(account);
    // Overlap the previous sync window by a day so late-arriving messages are not missed.
    const since = account.sync?.lastSyncedAt ? new Date(account.sync.lastSyncedAt.getTime() - 86_400_000) : undefined;
    let pageToken: string | undefined;
    do {
      const page = await provider.listMessages({ since, maxResults: Math.min(100, maxMessages - result.fetched), pageToken });
      // Oldest first, so threads and replies are stored in conversation order.
      const messages = [...page.messages].sort((a, b) => a.date.getTime() - b.date.getTime());
      for (const message of messages) {
        const parsed = parseProviderMessage(message, account.emailAddress);
        const stored = await storeParsedEmail(account, parsed);
        result.fetched += 1;
        if (stored.created) {
          result.created += 1;
          result.createdEmailIds.push(stored.emailId);
        }
      }
      pageToken = page.nextPageToken;
    } while (pageToken && result.fetched < maxMessages);

    await EmailAccount.updateOne({ _id: account._id }, { $set: { "sync.lastSyncedAt": new Date(), "sync.error": null } });
    log.info("Sync finished", { accountId, fetched: result.fetched, created: result.created });
    return result;
  } catch (err) {
    await EmailAccount.updateOne({ _id: account._id }, { $set: { "sync.error": errorMessage(err) } });
    throw err;
  } finally {
    await release();
  }
}

export async function syncUser(userId: string): Promise<SyncResult[]> {
  await connectDb();
  const accounts = await EmailAccount.find({ userId: toObjectId(userId) }).select("_id").lean();
  const results: SyncResult[] = [];
  for (const account of accounts) results.push(await syncAccount(account._id.toString()));
  return results;
}

/**
 * Mock Email Mode only: delivers the next "incoming" email from the fixtures, as if it had
 * just arrived. Lets you watch the AI pipeline process a brand-new message.
 */
export async function simulateIncomingEmail(userId: string): Promise<{ emailId: string; subject: string } | null> {
  await connectDb();
  const account = await EmailAccount.findOne({ userId: toObjectId(userId), provider: "mock" }).lean();
  if (!account) throw new ValidationError("Simulating email only works for the mock account");

  const delivered = new Set(
    (
      await Email.find({ accountId: account._id, providerMessageId: { $in: MOCK_INCOMING.map((f) => f.id) } })
        .select("providerMessageId")
        .lean()
    ).map((e) => e.providerMessageId),
  );
  const next = MOCK_INCOMING.find((f) => !delivered.has(f.id));
  if (!next) return null;

  const parsed = parseProviderMessage(fixtureToProviderMessage(next), account.emailAddress);
  const stored = await storeParsedEmail(account, parsed);
  return { emailId: stored.emailId, subject: parsed.subject };
}
