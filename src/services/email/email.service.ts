import "server-only";
import type { QueryFilter } from "mongoose";
import { connectDb, isObjectId, toObjectId } from "@/lib/db/mongoose";
import { Email, EmailAccount, EmailThread, type IEmail } from "@/lib/db/models";
import { NotFoundError } from "@/lib/utils/errors";
import type { EmailCategory, Urgency } from "@/schemas/common";
import type { EmailDetailDTO, EmailListItemDTO } from "@/types/email";
import { toEmailDetail, toEmailListItem } from "./dto";
import { getProviderForAccount } from "./providers";

export const INBOX_VIEWS = ["inbox", "unread", "needs_reply", "important", "archived", "sent", "all"] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];

export type InboxQuery = {
  view?: InboxView;
  category?: EmailCategory;
  urgency?: Urgency;
  /** Keyword search over subject, sender and body ($text index). */
  q?: string;
  page?: number;
  pageSize?: number;
};

const LIST_FIELDS =
  "threadId direction from subject snippet receivedAt labels isRead isImportant isArchived replyStatus ai.status ai.category ai.urgency ai.confidence ai.needsReply ai.summary";

export function buildInboxFilter(userId: string, query: InboxQuery): QueryFilter<IEmail> {
  const filter: QueryFilter<IEmail> = { userId: toObjectId(userId) };
  switch (query.view ?? "inbox") {
    case "inbox":
      Object.assign(filter, { direction: "inbound", isArchived: false });
      break;
    case "unread":
      Object.assign(filter, { direction: "inbound", isArchived: false, isRead: false });
      break;
    case "needs_reply":
      Object.assign(filter, { direction: "inbound", isArchived: false, replyStatus: { $in: ["needs_reply", "drafted"] } });
      break;
    case "important":
      Object.assign(filter, { direction: "inbound", isImportant: true });
      break;
    case "archived":
      Object.assign(filter, { direction: "inbound", isArchived: true });
      break;
    case "sent":
      Object.assign(filter, { direction: "outbound" });
      break;
    case "all":
      break;
  }
  if (query.category) filter["ai.category"] = query.category;
  if (query.urgency) filter["ai.urgency"] = query.urgency;
  if (query.q?.trim()) filter.$text = { $search: query.q.trim() };
  return filter;
}

export async function listEmails(
  userId: string,
  query: InboxQuery,
): Promise<{ items: EmailListItemDTO[]; total: number; page: number; pageSize: number }> {
  await connectDb();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const filter = buildInboxFilter(userId, query);
  const textSearch = Boolean(filter.$text);

  const [docs, total] = await Promise.all([
    Email.find(filter, textSearch ? { score: { $meta: "textScore" } } : {})
      .select(LIST_FIELDS)
      .sort(textSearch ? { score: { $meta: "textScore" }, receivedAt: -1 } : { receivedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Email.countDocuments(filter),
  ]);
  return { items: docs.map((d) => toEmailListItem(d as IEmail)), total, page, pageSize };
}

/** Loads an email and checks ownership. Every per-email operation goes through here. */
export async function getOwnedEmail(userId: string, emailId: string): Promise<IEmail> {
  await connectDb();
  if (!isObjectId(emailId)) throw new NotFoundError("Email");
  const email = await Email.findOne({ _id: toObjectId(emailId), userId: toObjectId(userId) }).lean();
  if (!email) throw new NotFoundError("Email");
  return email as IEmail;
}

export async function getThreadEmails(threadId: string): Promise<IEmail[]> {
  return (await Email.find({ threadId: toObjectId(threadId) }).sort({ receivedAt: 1 }).lean()) as IEmail[];
}

export async function getEmailDetail(userId: string, emailId: string): Promise<EmailDetailDTO> {
  const email = await getOwnedEmail(userId, emailId);
  const [thread, threadEmails] = await Promise.all([
    EmailThread.findById(email.threadId).lean(),
    getThreadEmails(email.threadId.toString()),
  ]);
  if (!thread) throw new NotFoundError("Thread");
  return toEmailDetail(email, thread, threadEmails);
}

async function providerFor(email: IEmail) {
  const account = await EmailAccount.findById(email.accountId).select("_id provider").lean();
  if (!account) throw new NotFoundError("Email account");
  return getProviderForAccount(account);
}

// The mailbox actions below change the provider first, then MailMind's copy, so a failed
// provider call never leaves the two out of sync.

export async function setEmailRead(userId: string, emailId: string, read: boolean): Promise<void> {
  const email = await getOwnedEmail(userId, emailId);
  if (email.isRead === read) return;
  await (await providerFor(email)).setRead(email.providerMessageId, read);
  await Email.updateOne({ _id: email._id }, { $set: { isRead: read } });
}

export async function setEmailArchived(userId: string, emailId: string, archived: boolean): Promise<void> {
  const email = await getOwnedEmail(userId, emailId);
  if (email.isArchived === archived) return;
  await (await providerFor(email)).setArchived(email.providerMessageId, archived);
  await Email.updateOne({ _id: email._id }, { $set: { isArchived: archived } });
}

export async function setEmailImportant(userId: string, emailId: string, important: boolean): Promise<void> {
  const email = await getOwnedEmail(userId, emailId);
  if (email.isImportant === important) return;
  await (await providerFor(email)).setImportant(email.providerMessageId, important);
  await Email.updateOne({ _id: email._id }, { $set: { isImportant: important } });
}

/** Lets the user dismiss "needs reply" (e.g. they answered by phone). */
export async function setReplyHandled(userId: string, emailId: string): Promise<void> {
  const email = await getOwnedEmail(userId, emailId);
  await Email.updateOne({ _id: email._id }, { $set: { replyStatus: "replied" } });
}
