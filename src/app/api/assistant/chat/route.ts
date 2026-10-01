import { apiRoute, parseBody, sseResponse } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { ChatRequestSchema } from "@/schemas/api";
import { streamAgentTurn } from "@/services/agent/run";

export const maxDuration = 300;

/** Sends a message to the agent and streams its activity, answer and approval requests (SSE). */
export const POST = apiRoute({ rateLimit: RATE_LIMITS.assistant }, async (req, { user }) => {
  const { message, conversationId } = await parseBody(req, ChatRequestSchema);
  return sseResponse(streamAgentTurn({ userId: user.id, conversationId, message, signal: req.signal }));
});
