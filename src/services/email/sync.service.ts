import "server-only";
import { connectDb, toObjectId } from "@/lib/db/mongoose";
import { AiDraft, Email, EmailAccount, EmailEmbedding, EmailThread, type IEmailAccount } from "@/lib/db/models";
import { acquireLock } from "@/lib/utils/cache";
import { getEnv } from "@/lib/utils/env";
import { ConflictError, errorMessage, ValidationError } from "@/lib/utils/errors";
import { createLogger } from "@/lib/utils/logger";
import { recordContacts } from "./contact.service";
import { parseProviderMessage, type ParsedEmail } from "./parser";
import { getProviderForAccount, type EmailProvider } from "./providers";
import type { MailboxStateUpdate } from "./providers/types";

const log = createLogger("sync");

export type SyncResult = {
  accountId: string;
  /** "full" = imported a time window; "incremental" = replayed Gmail history; "skipped" = another sync was running. */
  mode: "full" | "incremental" | "skipped";
  fetched: number;
  created: number;
  updated: number;
  removed: number;
  createdEmailIds: string[];
  error?: string;
};

/**
 * Stores one parsed email: upserts its thread, inserts the email (idempotent on the
 * provider message id), and updates contacts. Returns whether it was new.
 */
export async function storeParsedEmail(
  account: Pick<IEmailAccount, "_id" | "userId" | "emailAddress">,
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

  // Mailbox state (read/archived/starred) always comes from Gmail, so it is refreshed on
  // every sync while the content fields are written once.
  const providerState = { labels: parsed.labels, isRead: parsed.isRead, isImportant: parsed.isImportant, isArchived: parsed.isArchived };

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
      },
      $set: providerState,
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

async function storeMessages(account: IEmailAccount, messages: Parameters<typeof parseProviderMessage>[0][], result: SyncResult) {
  // Oldest first, so threads and replies are stored in conversation order.
  for (const message of [...messages].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const stored = await storeParsedEmail(account, parseProviderMessage(message));
    result.fetched += 1;
    if (stored.created) {
      result.created += 1;
      result.createdEmailIds.push(stored.emailId);
    }
  }
}

/** Imports every message received after `since`, page by page, up to the sync cap. */
async function windowedSync(account: IEmailAccount, provider: EmailProvider, since: Date, result: SyncResult) {
  const maxMessages = getEnv().GMAIL_SYNC_MAX_MESSAGES;
  let pageToken: string | undefined;
  do {
    const page = await provider.listMessages({ since, maxResults: Math.min(100, maxMessages - result.fetched), pageToken });
    await storeMessages(account, page.messages, result);
    pageToken = page.nextPageToken;
  } while (pageToken && result.fetched < maxMessages);
}

async function applyStateUpdates(accountId: IEmailAccount["_id"], updates: MailboxStateUpdate[]): Promise<number> {
  if (!updates.length) return 0;
  const res = await Email.bulkWrite(
    updates.map((u) => ({
      updateOne: {
        filter: { accountId, providerMessageId: u.providerMessageId },
        update: { $set: { labels: u.labels, isRead: u.isRead, isImportant: u.isImportant, isArchived: u.isArchived } },
      },
    })),
    { ordered: false },
  );
  return res.modifiedCount;
}

/** Messages deleted in Gmail are deleted from MailMind too, with everything derived from them. */
async function removeMessages(accountId: IEmailAccount["_id"], providerMessageIds: string[]): Promise<number> {
  if (!providerMessageIds.length) return 0;
  const emails = await Email.find({ accountId, providerMessageId: { $in: providerMessageIds } }).select("_id threadId").lean();
  if (!emails.length) return 0;
  const ids = emails.map((e) => e._id);
  await Promise.all([
    EmailEmbedding.deleteMany({ emailId: { $in: ids } }),
    AiDraft.updateMany({ emailId: { $in: ids }, status: { $in: ["pending_review", "failed"] } }, { $set: { status: "discarded" } }),
  ]);
  await Email.deleteMany({ _id: { $in: ids } });
  for (const threadId of new Set(emails.map((e) => e.threadId.toString()))) {
    const count = await Email.countDocuments({ threadId });
    await (count ? EmailThread.updateOne({ _id: threadId }, { $set: { messageCount: count } }) : EmailThread.deleteOne({ _id: threadId }));
  }
  return emails.length;
}

/**
 * Syncs one Gmail account.
 *
 *  - First sync: imports the last GMAIL_INITIAL_SYNC_DAYS days and stores Gmail's
 *    historyId as the cursor. The cursor is read *before* importing, so mail that arrives
 *    during a long import is picked up by the next sync rather than lost.
 *  - Every sync after that replays Gmail's history since the cursor: new mail, sent
 *    replies, read/star/archive changes and deletions. With nothing new it is a single
 *    request, which is what lets the app check for mail every minute.
 *  - If the cursor is too old (Gmail keeps about a week), it falls back to a windowed
 *    import from the last successful sync.
 */
export async function syncAccount(accountId: string, options: { ifIdle?: boolean } = {}): Promise<SyncResult> {
  await connectDb();
  const result: SyncResult = { accountId, mode: "incremental", fetched: 0, created: 0, updated: 0, removed: 0, createdEmailIds: [] };
  const release = await acquireLock(`sync:${accountId}`, 300);
  if (!release) {
    if (options.ifIdle) return { ...result, mode: "skipped" };
    throw new ConflictError("A sync is already running for this account");
  }

  const account = (await EmailAccount.findById(accountId).lean()) as IEmailAccount | null;
  if (!account) {
    await release();
    throw new ValidationError("Unknown email account");
  }

  try {
    const env = getEnv();
    const provider = await getProviderForAccount(account);
    const cursor = account.sync?.historyId;
    let nextCursor: string;

    const changes = cursor ? await provider.listChanges(cursor, { maxMessages: env.GMAIL_SYNC_MAX_MESSAGES }) : null;
    if (changes?.status === "ok") {
      await storeMessages(account, changes.messages, result);
      result.updated = await applyStateUpdates(account._id, changes.updates);
      result.removed = await removeMessages(account._id, changes.removedIds);
      nextCursor = changes.cursor;
    } else {
      result.mode = "full";
      nextCursor = await provider.getSyncCursor();
      const since = account.sync?.lastSyncedAt
        ? new Date(account.sync.lastSyncedAt.getTime() - 86_400_000) // overlap a day; inserts are idempotent
        : new Date(Date.now() - env.GMAIL_INITIAL_SYNC_DAYS * 86_400_000);
      await windowedSync(account, provider, since, result);
    }

    await EmailAccount.updateOne(
      { _id: account._id },
      { $set: { "sync.lastSyncedAt": new Date(), "sync.historyId": nextCursor, "sync.error": null } },
    );
    if (result.mode === "full" || result.fetched || result.updated || result.removed) {
      log.info("Sync finished", { accountId, mode: result.mode, created: result.created, updated: result.updated, removed: result.removed });
    }
    return result;
  } catch (err) {
    await EmailAccount.updateOne({ _id: account._id }, { $set: { "sync.error": errorMessage(err) } });
    throw err;
  } finally {
    await release();
  }
}

/** Syncs every account of a user. One failing account doesn't stop the others. */
export async function syncUser(userId: string, options: { ifIdle?: boolean } = {}): Promise<SyncResult[]> {
  await connectDb();
  const accounts = await EmailAccount.find({ userId: toObjectId(userId) }).select("_id").lean();
  const results: SyncResult[] = [];
  for (const account of accounts) {
    try {
      results.push(await syncAccount(account._id.toString(), options));
    } catch (err) {
      log.warn("Account sync failed", { accountId: account._id.toString(), error: errorMessage(err) });
      results.push({
        accountId: account._id.toString(),
        mode: "skipped",
        fetched: 0,
        created: 0,
        updated: 0,
        removed: 0,
        createdEmailIds: [],
        error: errorMessage(err),
      });
    }
  }
  return results;
}
