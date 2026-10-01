import "server-only";
import { z } from "zod";
import { toObjectId } from "@/lib/db/mongoose";
import { Email, EmailThread, type IEmail } from "@/lib/db/models";
import { bodyForAi, formatAddressHeader } from "@/lib/utils/email-text";
import { NotFoundError } from "@/lib/utils/errors";
import { EmailCategorySchema, UrgencySchema } from "@/schemas/common";
import { getOwnedEmail, setEmailArchived, setEmailImportant } from "@/services/email/email.service";
import { searchEmails as hybridSearch } from "@/services/search/search.service";
import { defineAgentTool, type AgentToolContext } from "./define-tool";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The compact shape the model sees for an email in a list. */
function compact(e: IEmail) {
  return {
    id: e._id.toString(),
    threadId: e.threadId.toString(),
    from: formatAddressHeader([e.from]),
    subject: e.subject,
    date: e.receivedAt.toISOString(),
    category: e.ai?.category ?? null,
    urgency: e.ai?.urgency ?? null,
    replyStatus: e.replyStatus,
    unread: !e.isRead,
    summary: e.ai?.summary ?? e.snippet,
  };
}

export function emailTools(ctx: AgentToolContext) {
  const userObjectId = toObjectId(ctx.userId);

  const searchEmails = defineAgentTool(ctx, {
    name: "searchEmails",
    icon: "🔎",
    description:
      "Find emails by structured filters and/or keywords. Use for requests like 'emails from Ali', 'unread finance emails this week', or 'emails that need a reply'. Returns a compact list with AI summaries; call getEmail for the full text. For questions about meaning or topics ('payment problems'), prefer semanticSearch.",
    schema: z.object({
      keywords: z.string().optional().describe("Words that must appear (matched against subject, sender and body)."),
      from: z.string().optional().describe("Sender name or email address, or part of it, e.g. 'Ali' or 'northwind'."),
      category: EmailCategorySchema.optional(),
      urgency: UrgencySchema.optional(),
      needsReply: z.boolean().optional().describe("Only emails still waiting for the user's reply."),
      unreadOnly: z.boolean().optional(),
      includeArchived: z.boolean().optional(),
      newerThanDays: z.number().int().min(1).max(365).optional().describe("Only emails from the last N days."),
      limit: z.number().int().min(1).max(25).optional().describe("Default 10."),
    }),
    label: () => "Searching emails…",
    run: async (input) => {
      const filter: Record<string, unknown> = { userId: userObjectId, direction: "inbound" };
      if (!input.includeArchived) filter.isArchived = false;
      if (input.from) {
        const rx = new RegExp(escapeRegex(input.from.trim()), "i");
        filter.$or = [{ "from.name": rx }, { "from.email": rx }];
      }
      if (input.category) filter["ai.category"] = input.category;
      if (input.urgency) filter["ai.urgency"] = input.urgency;
      if (input.needsReply) filter.replyStatus = { $in: ["needs_reply", "drafted"] };
      if (input.unreadOnly) filter.isRead = false;
      if (input.newerThanDays) filter.receivedAt = { $gte: new Date(Date.now() - input.newerThanDays * 86_400_000) };
      if (input.keywords?.trim()) filter.$text = { $search: input.keywords.trim() };

      const docs = (await Email.find(filter)
        .sort({ receivedAt: -1 })
        .limit(input.limit ?? 10)
        .lean()) as IEmail[];
      return {
        result: { count: docs.length, emails: docs.map(compact) },
        summary: `Found ${docs.length} email${docs.length === 1 ? "" : "s"}`,
      };
    },
  });

  const semanticSearch = defineAgentTool(ctx, {
    name: "semanticSearch",
    icon: "🧭",
    description:
      "Search emails by meaning (vector search combined with keywords). Use for topics and fuzzy questions, e.g. 'payment problems', 'anything about the product launch'. Returns the best-matching emails with the relevant excerpt.",
    schema: z.object({
      query: z.string().min(2).describe("A natural-language description of what to find."),
      limit: z.number().int().min(1).max(10).optional().describe("Default 6."),
    }),
    label: () => "Searching by meaning…",
    run: async (input) => {
      const { results } = await hybridSearch(ctx.userId, { query: input.query, mode: "hybrid", limit: input.limit ?? 6 });
      return {
        result: {
          count: results.length,
          emails: results.map((r) => ({
            id: r.email.id,
            threadId: r.email.threadId,
            from: formatAddressHeader([r.email.from]),
            subject: r.email.subject,
            date: r.email.receivedAt,
            category: r.email.ai.category ?? null,
            excerpt: r.excerpt ?? r.email.ai.summary ?? r.email.snippet,
          })),
        },
        summary: `Found ${results.length} relevant email${results.length === 1 ? "" : "s"}`,
      };
    },
  });

  const getEmail = defineAgentTool(ctx, {
    name: "getEmail",
    icon: "📖",
    description: "Read one email in full, including MailMind's AI analysis (summary, category, urgency, extracted tasks and dates).",
    schema: z.object({ emailId: z.string().describe("The email id from a search result.") }),
    label: () => "Reading email…",
    run: async ({ emailId }) => {
      const e = await getOwnedEmail(ctx.userId, emailId);
      return {
        result: {
          ...compact(e),
          to: formatAddressHeader(e.to),
          cc: formatAddressHeader(e.cc),
          body: bodyForAi(e.bodyText, 6_000),
          analysis: {
            summary: e.ai?.summary ?? null,
            category: e.ai?.category ?? null,
            urgency: e.ai?.urgency ?? null,
            urgencyReasons: e.ai?.urgencyReasons ?? [],
            needsReply: e.ai?.needsReply ?? false,
            extracted: e.ai?.extracted ?? null,
          },
        },
        summary: `Read “${e.subject}”`,
      };
    },
  });

  const getConversation = defineAgentTool(ctx, {
    name: "getConversation",
    icon: "🧵",
    description:
      "Read a whole email thread: MailMind's memory of the conversation (summary, facts, commitments, open questions) plus the most recent messages. Use before replying so you stay consistent with what was already agreed.",
    schema: z.object({
      threadId: z.string().optional().describe("Thread id from a search result."),
      emailId: z.string().optional().describe("Or any email id in the thread."),
    }),
    label: () => "Reading the conversation…",
    run: async (input) => {
      let threadId = input.threadId;
      if (!threadId && input.emailId) threadId = (await getOwnedEmail(ctx.userId, input.emailId)).threadId.toString();
      if (!threadId || !/^[0-9a-f]{24}$/i.test(threadId)) throw new NotFoundError("Thread");
      const thread = await EmailThread.findOne({ _id: toObjectId(threadId), userId: userObjectId }).lean();
      if (!thread) throw new NotFoundError("Thread");
      const messages = (await Email.find({ threadId: thread._id }).sort({ receivedAt: -1 }).limit(8).lean()).reverse() as IEmail[];
      return {
        result: {
          threadId,
          subject: thread.subject,
          messageCount: thread.messageCount,
          memory: thread.memory
            ? {
                summary: thread.memory.summary,
                facts: thread.memory.facts,
                commitments: thread.memory.commitments,
                openQuestions: thread.memory.openQuestions,
              }
            : null,
          messages: messages.map((m) => ({
            id: m._id.toString(),
            sentByUser: m.direction === "outbound",
            from: formatAddressHeader([m.from]),
            date: m.receivedAt.toISOString(),
            body: bodyForAi(m.bodyText, 2_000),
          })),
        },
        summary: `Read ${messages.length} message${messages.length === 1 ? "" : "s"} in “${thread.subject}”`,
      };
    },
  });

  const archiveEmail = defineAgentTool(ctx, {
    name: "archiveEmail",
    icon: "🗄️",
    description: "Archive one email (removes it from the inbox; it can be restored). Only use when the user asks you to archive or clean up.",
    schema: z.object({ emailId: z.string() }),
    label: () => "Archiving email…",
    run: async ({ emailId }) => {
      const e = await getOwnedEmail(ctx.userId, emailId);
      await setEmailArchived(ctx.userId, emailId, true);
      return { result: { archived: true, emailId }, summary: `Archived “${e.subject}”` };
    },
  });

  const markAsImportant = defineAgentTool(ctx, {
    name: "markAsImportant",
    icon: "⭐",
    description: "Mark (or unmark) one email as important.",
    schema: z.object({ emailId: z.string(), important: z.boolean().optional().describe("Default true.") }),
    label: (input) => (input.important === false ? "Removing importance…" : "Marking as important…"),
    run: async ({ emailId, important }) => {
      const e = await getOwnedEmail(ctx.userId, emailId);
      await setEmailImportant(ctx.userId, emailId, important ?? true);
      return {
        result: { emailId, important: important ?? true },
        summary: `${important === false ? "Unmarked" : "Marked"} “${e.subject}”${important === false ? "" : " as important"}`,
      };
    },
  });

  return [searchEmails, semanticSearch, getEmail, getConversation, archiveEmail, markAsImportant];
}
