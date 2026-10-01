import { apiRoute } from "@/lib/utils/http";
import { deleteConversation, getConversationDetail } from "@/services/agent/conversation.service";

export const GET = apiRoute<{ id: string }>({}, async (_req, { user, params }) => ({
  conversation: await getConversationDetail(user.id, params.id),
}));

export const DELETE = apiRoute<{ id: string }>({}, async (_req, { user, params }) => {
  await deleteConversation(user.id, params.id);
  return { ok: true };
});
