import { apiRoute } from "@/lib/utils/http";
import { listConversations } from "@/services/agent/conversation.service";

export const GET = apiRoute({}, async (_req, { user }) => ({ conversations: await listConversations(user.id) }));
