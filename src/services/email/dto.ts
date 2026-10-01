import "server-only";
import type { IAiDraft, IContact, IEmail, IEmailThread } from "@/lib/db/models";
import type { ContactDTO, DraftDTO, EmailDetailDTO, EmailListItemDTO, ThreadMemoryDTO } from "@/types/email";

// Mappers from database documents to the JSON DTOs the UI receives. Keeping this in one
// place guarantees we never accidentally ship internal fields (or tokens) to the browser.

type EmailLike = Pick<
  IEmail,
  | "_id"
  | "threadId"
  | "direction"
  | "from"
  | "subject"
  | "snippet"
  | "receivedAt"
  | "labels"
  | "isRead"
  | "isImportant"
  | "isArchived"
  | "replyStatus"
  | "ai"
>;

const address = (a: { name?: string; email: string }) => (a.name ? { name: a.name, email: a.email } : { email: a.email });

export function toEmailListItem(email: EmailLike): EmailListItemDTO {
  return {
    id: email._id.toString(),
    threadId: email.threadId.toString(),
    direction: email.direction,
    from: address(email.from),
    subject: email.subject,
    snippet: email.snippet,
    receivedAt: email.receivedAt.toISOString(),
    labels: email.labels ?? [],
    isRead: email.isRead,
    isImportant: email.isImportant,
    isArchived: email.isArchived,
    replyStatus: email.replyStatus,
    ai: {
      status: email.ai?.status ?? "pending",
      category: email.ai?.category,
      urgency: email.ai?.urgency,
      confidence: email.ai?.confidence,
      needsReply: email.ai?.needsReply ?? false,
      summary: email.ai?.summary,
    },
  };
}

export function toThreadMemory(memory: IEmailThread["memory"]): ThreadMemoryDTO | undefined {
  if (!memory) return undefined;
  return {
    summary: memory.summary,
    facts: memory.facts ?? [],
    commitments: (memory.commitments ?? []).map((c) => ({ by: c.by, text: c.text, due: c.due ?? null })),
    openQuestions: memory.openQuestions ?? [],
    updatedAt: memory.updatedAt.toISOString(),
  };
}

export function toEmailDetail(email: IEmail, thread: IEmailThread, threadEmails: IEmail[]): EmailDetailDTO {
  const base = toEmailListItem(email);
  const ai = email.ai;
  return {
    ...base,
    to: email.to.map(address),
    cc: email.cc.map(address),
    bodyText: email.bodyText,
    ai: {
      ...base.ai,
      error: ai?.error,
      processedAt: ai?.processedAt?.toISOString(),
      categoryReason: ai?.categoryReason,
      urgencyReasons: ai?.urgencyReasons ?? [],
      respondBy: ai?.respondBy ?? null,
      summaryShort: ai?.summaryShort,
      summaryDetailed: ai?.summaryDetailed,
      extracted: ai?.extracted
        ? {
            people: ai.extracted.people ?? [],
            companies: ai.extracted.companies ?? [],
            dates: ai.extracted.dates ?? [],
            times: ai.extracted.times ?? [],
            phoneNumbers: ai.extracted.phoneNumbers ?? [],
            links: ai.extracted.links ?? [],
            tasks: ai.extracted.tasks ?? [],
            deadlines: ai.extracted.deadlines ?? [],
          }
        : undefined,
      actions: (ai?.actions ?? []).map((a) => ({ type: a.type, reason: a.reason, automatic: a.automatic })),
      model: ai?.model,
    },
    thread: {
      id: thread._id.toString(),
      subject: thread.subject,
      messageCount: threadEmails.length,
      messages: threadEmails.map((m) => ({
        id: m._id.toString(),
        direction: m.direction,
        from: address(m.from),
        to: m.to.map(address),
        cc: m.cc.map(address),
        subject: m.subject,
        bodyText: m.bodyText,
        receivedAt: m.receivedAt.toISOString(),
      })),
      memory: toThreadMemory(thread.memory),
    },
  };
}

export function toDraftDTO(
  draft: IAiDraft,
  replyTo?: Pick<IEmail, "from" | "subject" | "receivedAt"> | null,
): DraftDTO {
  return {
    id: draft._id.toString(),
    emailId: draft.emailId?.toString(),
    threadId: draft.threadId?.toString(),
    to: draft.to.map(address),
    cc: draft.cc.map(address),
    subject: draft.subject,
    body: draft.body,
    originalBody: draft.originalBody,
    status: draft.status,
    source: draft.source,
    notes: draft.notes ?? [],
    model: draft.model,
    error: draft.error,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    sentAt: draft.sentAt?.toISOString(),
    replyTo: replyTo
      ? { from: address(replyTo.from), subject: replyTo.subject, receivedAt: replyTo.receivedAt.toISOString() }
      : undefined,
  };
}

export function toContactDTO(contact: IContact): ContactDTO {
  return {
    id: contact._id.toString(),
    email: contact.email,
    name: contact.name,
    company: contact.company,
    relationship: contact.relationship,
    emailCount: contact.emailCount,
    lastEmailAt: contact.lastEmailAt?.toISOString(),
  };
}
