import "server-only";
import { connectDb, toObjectId } from "@/lib/db/mongoose";
import { AiDraft, Email, type IEmail } from "@/lib/db/models";
import { EMAIL_CATEGORIES, URGENCY_LEVELS, type EmailCategory, type Urgency } from "@/schemas/common";
import { toEmailListItem } from "@/services/email/dto";
import type { DashboardStatsDTO, EmailListItemDTO } from "@/types/email";

/** One aggregation ($facet) computes every dashboard number in a single round trip. */
export async function getDashboardStats(userId: string): Promise<DashboardStatsDTO> {
  await connectDb();
  const uid = toObjectId(userId);
  const [facets] = await Email.aggregate<{
    total: { n: number }[];
    unread: { n: number }[];
    important: { n: number }[];
    needsReply: { n: number }[];
    status: { _id: string; n: number }[];
    byCategory: { _id: EmailCategory; n: number }[];
    byUrgency: { _id: Urgency; n: number }[];
  }>([
    { $match: { userId: uid, direction: "inbound" } },
    {
      $facet: {
        total: [{ $count: "n" }],
        unread: [{ $match: { isRead: false, isArchived: false } }, { $count: "n" }],
        important: [{ $match: { isImportant: true } }, { $count: "n" }],
        needsReply: [{ $match: { isArchived: false, replyStatus: { $in: ["needs_reply", "drafted"] } } }, { $count: "n" }],
        status: [{ $group: { _id: "$ai.status", n: { $sum: 1 } } }],
        byCategory: [{ $match: { "ai.category": { $ne: null } } }, { $group: { _id: "$ai.category", n: { $sum: 1 } } }],
        byUrgency: [{ $match: { "ai.urgency": { $ne: null }, isArchived: false } }, { $group: { _id: "$ai.urgency", n: { $sum: 1 } } }],
      },
    },
  ]);
  const count = (rows: { n: number }[] | undefined) => rows?.[0]?.n ?? 0;
  const status = new Map((facets?.status ?? []).map((s) => [s._id, s.n]));
  const categories = new Map((facets?.byCategory ?? []).map((c) => [c._id, c.n]));
  const urgencies = new Map((facets?.byUrgency ?? []).map((u) => [u._id, u.n]));
  const pendingDrafts = await AiDraft.countDocuments({ userId: uid, status: { $in: ["pending_review", "failed"] } });

  return {
    total: count(facets?.total),
    unread: count(facets?.unread),
    important: count(facets?.important),
    needsReply: count(facets?.needsReply),
    aiProcessed: status.get("processed") ?? 0,
    aiPending: (status.get("pending") ?? 0) + (status.get("processing") ?? 0),
    aiFailed: status.get("failed") ?? 0,
    pendingDrafts,
    byCategory: EMAIL_CATEGORIES.map((category) => ({ category, count: categories.get(category) ?? 0 }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count),
    byUrgency: URGENCY_LEVELS.map((urgency) => ({ urgency, count: urgencies.get(urgency) ?? 0 })),
  };
}

/** Emails that most need attention: high urgency first, then needing a reply. */
export async function getPriorityEmails(userId: string, limit = 6): Promise<EmailListItemDTO[]> {
  await connectDb();
  const docs = (await Email.find({
    userId: toObjectId(userId),
    direction: "inbound",
    isArchived: false,
    $or: [{ "ai.urgency": "high" }, { replyStatus: { $in: ["needs_reply", "drafted"] } }],
    "ai.category": { $ne: "spam" },
  })
    .sort({ receivedAt: -1 })
    .limit(30)
    .lean()) as IEmail[];
  const rank = (e: IEmail) => (e.ai?.urgency === "high" ? 0 : e.ai?.urgency === "medium" ? 1 : 2);
  return docs
    .sort((a, b) => rank(a) - rank(b) || b.receivedAt.getTime() - a.receivedAt.getTime())
    .slice(0, limit)
    .map(toEmailListItem);
}
