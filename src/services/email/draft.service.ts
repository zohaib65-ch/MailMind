import "server-only";
import { connectDb, isObjectId, toObjectId } from "@/lib/db/mongoose";
import { AiDraft, Email, EmailAccount, User, type IAiDraft } from "@/lib/db/models";
import { makeSnippet } from "@/lib/utils/email-text";
import { ConflictError, errorMessage, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { createLogger } from "@/lib/utils/logger";
import type { DraftSource, DraftStatus, EmailAddress } from "@/schemas/common";
import type { DraftDTO } from "@/types/email";
import { toDraftDTO } from "./dto";
import { getOwnedEmail } from "./email.service";
import { getProviderForAccount } from "./providers";
import { storeParsedEmail } from "./sync.service";

const log = createLogger("drafts");

/*
 * Human-in-the-loop lives here.
 *
 *   createDraft()        AI or user creates a draft            → pending_review
 *   updateDraft()        user edits it                         (still pending_review)
 *   approveDraft()       ONLY called from user-initiated routes → approved
 *   sendApprovedDraft()  sends, but refuses unless approved    → sending → sent
 *
 * The AI agent's sendEmail tool can only reach sendApprovedDraft(). It has no way to call
 * approveDraft(), so even a misbehaving model cannot send an email the user has not
 * explicitly approved.
 */

export type DraftEdits = { to?: EmailAddress[]; cc?: EmailAddress[]; subject?: string; body?: string };

async function withReplyContext(drafts: IAiDraft[]): Promise<DraftDTO[]> {
  const emailIds = drafts.map((d) => d.emailId).filter((id): id is NonNullable<typeof id> => Boolean(id));
  const emails = emailIds.length
    ? await Email.find({ _id: { $in: emailIds } }).select("from subject receivedAt").lean()
    : [];
  const byId = new Map(emails.map((e) => [e._id.toString(), e]));
  return drafts.map((d) => toDraftDTO(d, d.emailId ? byId.get(d.emailId.toString()) : null));
}

async function getOwnedDraft(userId: string, draftId: string): Promise<IAiDraft> {
  await connectDb();
  if (!isObjectId(draftId)) throw new NotFoundError("Draft");
  const draft = await AiDraft.findOne({ _id: toObjectId(draftId), userId: toObjectId(userId) }).lean();
  if (!draft) throw new NotFoundError("Draft");
  return draft as IAiDraft;
}

export async function createDraft(input: {
  userId: string;
  emailId?: string;
  accountId?: string;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  body: string;
  source: DraftSource;
  notes?: string[];
  model?: string;
  conversationId?: string;
}): Promise<DraftDTO> {
  await connectDb();
  const replyTo = input.emailId ? await getOwnedEmail(input.userId, input.emailId) : null;
  const accountId =
    replyTo?.accountId ??
    (input.accountId ? toObjectId(input.accountId) : (await EmailAccount.findOne({ userId: toObjectId(input.userId) }).lean())?._id);
  if (!accountId) throw new ValidationError("No email account to send from");

  const to = input.to?.length ? input.to : replyTo ? [replyTo.from] : [];
  if (!to.length) throw new ValidationError("A draft needs at least one recipient");

  // A new AI suggestion replaces the previous *untouched* AI draft for this email. Drafts the
  // user wrote or edited are never thrown away.
  if (replyTo) {
    await AiDraft.updateMany(
      {
        userId: toObjectId(input.userId),
        emailId: replyTo._id,
        status: "pending_review",
        source: { $in: ["pipeline", "agent"] },
        $expr: { $eq: ["$body", "$originalBody"] },
      },
      { $set: { status: "discarded" } },
    );
  }

  const draft = await AiDraft.create({
    userId: toObjectId(input.userId),
    accountId,
    emailId: replyTo?._id,
    threadId: replyTo?.threadId,
    to,
    cc: input.cc ?? [],
    subject: input.subject,
    body: input.body,
    originalBody: input.source === "user" ? undefined : input.body,
    source: input.source,
    notes: input.notes ?? [],
    model: input.model,
    conversationId: input.conversationId ? toObjectId(input.conversationId) : undefined,
  });

  if (replyTo && replyTo.replyStatus !== "replied") {
    await Email.updateOne({ _id: replyTo._id }, { $set: { replyStatus: "drafted" } });
  }
  return toDraftDTO(draft.toObject() as IAiDraft, replyTo);
}

export async function listDrafts(userId: string, statuses: DraftStatus[] = ["pending_review", "failed"]): Promise<DraftDTO[]> {
  await connectDb();
  const drafts = await AiDraft.find({ userId: toObjectId(userId), status: { $in: statuses } })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  return withReplyContext(drafts as IAiDraft[]);
}

export async function getDraft(userId: string, draftId: string): Promise<DraftDTO> {
  const [dto] = await withReplyContext([await getOwnedDraft(userId, draftId)]);
  return dto!;
}

export async function getDraftsByIds(userId: string, draftIds: string[]): Promise<DraftDTO[]> {
  await connectDb();
  const ids = draftIds.filter(isObjectId).map(toObjectId);
  if (!ids.length) return [];
  const drafts = await AiDraft.find({ _id: { $in: ids }, userId: toObjectId(userId) }).lean();
  return withReplyContext(drafts as IAiDraft[]);
}

export async function getLatestDraftForEmail(userId: string, emailId: string): Promise<DraftDTO | null> {
  await connectDb();
  if (!isObjectId(emailId)) return null;
  const draft = await AiDraft.findOne({
    userId: toObjectId(userId),
    emailId: toObjectId(emailId),
    status: { $in: ["pending_review", "failed", "sent"] },
  })
    .sort({ createdAt: -1 })
    .lean();
  return draft ? (await withReplyContext([draft as IAiDraft]))[0]! : null;
}

function editsToSet(edits: DraftEdits): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  if (edits.to) set.to = edits.to;
  if (edits.cc) set.cc = edits.cc;
  if (edits.subject !== undefined) set.subject = edits.subject;
  if (edits.body !== undefined) set.body = edits.body;
  return set;
}

export async function updateDraft(userId: string, draftId: string, edits: DraftEdits): Promise<DraftDTO> {
  await getOwnedDraft(userId, draftId);
  const updated = await AiDraft.findOneAndUpdate(
    { _id: toObjectId(draftId), userId: toObjectId(userId), status: { $in: ["pending_review", "failed"] } },
    { $set: { ...editsToSet(edits), status: "pending_review" } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) throw new ConflictError("This draft can no longer be edited");
  return getDraft(userId, draftId);
}

export async function discardDraft(userId: string, draftId: string): Promise<void> {
  await getOwnedDraft(userId, draftId);
  const result = await AiDraft.updateOne(
    { _id: toObjectId(draftId), userId: toObjectId(userId), status: { $in: ["pending_review", "failed", "approved"] } },
    { $set: { status: "discarded" } },
  );
  if (!result.modifiedCount) throw new ConflictError("This draft can no longer be discarded");
}

/**
 * Records the user's explicit approval (optionally with final edits). Must only be called
 * from a request the user made themselves — never from an AI tool.
 */
export async function approveDraft(userId: string, draftId: string, edits: DraftEdits = {}): Promise<IAiDraft> {
  await getOwnedDraft(userId, draftId);
  // "approved" is accepted too, so a draft whose send never started (e.g. the assistant run
  // was interrupted) can be approved again instead of getting stuck.
  const approved = await AiDraft.findOneAndUpdate(
    { _id: toObjectId(draftId), userId: toObjectId(userId), status: { $in: ["pending_review", "failed", "approved"] } },
    { $set: { ...editsToSet(edits), status: "approved", approvedAt: new Date(), error: null } },
    { returnDocument: "after" },
  ).lean();
  if (!approved) throw new ConflictError("This draft is not waiting for approval");
  if (!approved.body.trim() || !approved.to.length) throw new ValidationError("A draft needs a recipient and a body");
  return approved as IAiDraft;
}

/** Sends a draft the user has already approved. Refuses anything else. */
export async function sendApprovedDraft(userId: string, draftId: string): Promise<DraftDTO> {
  await getOwnedDraft(userId, draftId);
  // Atomic claim: only one request can move approved → sending, so no double sends.
  const draft = (await AiDraft.findOneAndUpdate(
    { _id: toObjectId(draftId), userId: toObjectId(userId), status: "approved" },
    { $set: { status: "sending" } },
    { returnDocument: "after" },
  ).lean()) as IAiDraft | null;
  if (!draft) throw new ConflictError("Only drafts approved by the user can be sent");

  let sent: Awaited<ReturnType<Awaited<ReturnType<typeof getProviderForAccount>>["sendMessage"]>>;
  let context: {
    account: NonNullable<Awaited<ReturnType<typeof loadSendContext>>["account"]>;
    replyTo: Awaited<ReturnType<typeof loadSendContext>>["replyTo"];
    from: EmailAddress;
    references: string[];
  };
  try {
    const { account, user, replyTo } = await loadSendContext(draft);
    if (!account || !user) throw new NotFoundError("Email account");
    const references = replyTo
      ? [...(replyTo.references ?? []), ...(replyTo.messageIdHeader ? [replyTo.messageIdHeader] : [])]
      : [];
    const from = { name: user.name ?? account.displayName, email: account.emailAddress };
    context = { account, replyTo, from, references };
    const provider = await getProviderForAccount(account);
    sent = await provider.sendMessage({
      from,
      to: draft.to,
      cc: draft.cc,
      subject: draft.subject,
      textBody: draft.body,
      inReplyTo: replyTo?.messageIdHeader,
      references,
      providerThreadId: replyTo?.providerThreadId,
    });
  } catch (err) {
    // Nothing was sent, so the user can safely fix the problem and try again.
    await AiDraft.updateOne({ _id: draft._id, status: "sending" }, { $set: { status: "failed", error: errorMessage(err) } });
    throw err;
  }

  // The provider accepted the email: record that FIRST. From here on nothing may mark the
  // draft "failed", or a retry would send the same email twice.
  await AiDraft.updateOne(
    { _id: draft._id },
    { $set: { status: "sent", sentAt: new Date(), sentProviderMessageId: sent.providerMessageId, error: null } },
  );
  log.info("Draft sent", { draftId, provider: context.account.provider });

  // Bookkeeping is best-effort; the next sync repairs anything that fails here.
  try {
    await storeParsedEmail(context.account, {
      providerMessageId: sent.providerMessageId,
      providerThreadId: sent.providerThreadId,
      messageIdHeader: sent.messageIdHeader,
      inReplyTo: context.replyTo?.messageIdHeader,
      references: context.references,
      direction: "outbound",
      from: context.from,
      to: draft.to,
      cc: draft.cc,
      subject: draft.subject,
      bodyText: draft.body,
      snippet: makeSnippet(draft.body),
      receivedAt: new Date(),
      labels: ["SENT"],
      isRead: true,
      isImportant: false,
      isArchived: false,
    });
    if (context.replyTo) await Email.updateOne({ _id: context.replyTo._id }, { $set: { replyStatus: "replied" } });
  } catch (err) {
    log.warn("Sent, but saving the local copy failed (next sync will fix it)", { draftId, error: errorMessage(err) });
  }
  return getDraft(userId, draftId);
}

async function loadSendContext(draft: IAiDraft) {
  const [account, user, replyTo] = await Promise.all([
    EmailAccount.findById(draft.accountId).lean(),
    User.findById(draft.userId).lean(),
    draft.emailId ? Email.findById(draft.emailId).lean() : null,
  ]);
  return { account, user, replyTo };
}

/** The "Send" button: the click is the approval. */
export async function approveAndSendDraft(userId: string, draftId: string, edits: DraftEdits = {}): Promise<DraftDTO> {
  await approveDraft(userId, draftId, edits);
  return sendApprovedDraft(userId, draftId);
}
