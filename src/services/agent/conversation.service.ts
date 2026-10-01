import "server-only";
import { Types } from "mongoose";
import { connectDb, isObjectId, toObjectId } from "@/lib/db/mongoose";
import { AiConversation, type IAiConversation } from "@/lib/db/models";
import { NotFoundError } from "@/lib/utils/errors";
import { getDraftsByIds } from "@/services/email/draft.service";
import type { ActivityStep, ConversationDetailDTO, ConversationSummaryDTO, SendApprovalRequest } from "@/types/agent";
import { getCheckpointer } from "./checkpointer";

export async function createConversation(userId: string, firstMessage: string): Promise<IAiConversation> {
  await connectDb();
  const title = firstMessage.replace(/\s+/g, " ").trim().slice(0, 80) || "New conversation";
  const conversation = await AiConversation.create({ userId: toObjectId(userId), title, messages: [] });
  return conversation.toObject() as IAiConversation;
}

export async function getOwnedConversation(userId: string, conversationId: string): Promise<IAiConversation> {
  await connectDb();
  if (!isObjectId(conversationId)) throw new NotFoundError("Conversation");
  const conversation = await AiConversation.findOne({ _id: toObjectId(conversationId), userId: toObjectId(userId) }).lean();
  if (!conversation) throw new NotFoundError("Conversation");
  return conversation as IAiConversation;
}

export async function listConversations(userId: string): Promise<ConversationSummaryDTO[]> {
  await connectDb();
  const rows = await AiConversation.find({ userId: toObjectId(userId) })
    .select("title updatedAt pendingApproval")
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
  return rows.map((c) => ({
    id: c._id.toString(),
    title: c.title,
    updatedAt: c.updatedAt.toISOString(),
    hasPendingApproval: Boolean(c.pendingApproval),
  }));
}

export async function getConversationDetail(userId: string, conversationId: string): Promise<ConversationDetailDTO> {
  const conversation = await getOwnedConversation(userId, conversationId);
  const allDraftIds = conversation.messages.flatMap((m) => m.draftIds.map((id) => id.toString()));
  const drafts = new Map((await getDraftsByIds(userId, allDraftIds)).map((d) => [d.id, d]));
  return {
    id: conversation._id.toString(),
    title: conversation.title,
    pendingApproval: conversation.pendingApproval ?? null,
    messages: conversation.messages.map((m) => ({
      id: m._id.toString(),
      role: m.role,
      content: m.content,
      activity: m.activity ?? [],
      drafts: m.draftIds.map((id) => drafts.get(id.toString())).filter((d): d is NonNullable<typeof d> => Boolean(d)),
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function appendMessage(
  conversationId: string,
  message: { role: "user" | "assistant"; content: string; activity?: ActivityStep[]; draftIds?: string[] },
): Promise<string> {
  const id = new Types.ObjectId();
  await AiConversation.updateOne(
    { _id: toObjectId(conversationId) },
    {
      $push: {
        messages: {
          _id: id,
          role: message.role,
          content: message.content,
          activity: message.activity ?? [],
          draftIds: (message.draftIds ?? []).filter(isObjectId).map(toObjectId),
          createdAt: new Date(),
        },
      },
    },
  );
  return id.toString();
}

export async function setPendingApproval(conversationId: string, approval: SendApprovalRequest | null): Promise<void> {
  await AiConversation.updateOne({ _id: toObjectId(conversationId) }, { $set: { pendingApproval: approval } });
}

export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  const conversation = await getOwnedConversation(userId, conversationId);
  await AiConversation.deleteOne({ _id: conversation._id });
  // Also forget the agent's checkpointed state for this thread.
  const saver = await getCheckpointer();
  await saver.deleteThread(conversation._id.toString());
}
