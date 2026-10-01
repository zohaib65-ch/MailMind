import { apiRoute, parseBody } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { GenerateReplySchema } from "@/schemas/api";
import { generateReplyDraft } from "@/services/ai/reply.service";

export const maxDuration = 60;

/** "Generate AI Reply": drafts a reply for review. Never sends. */
export const POST = apiRoute<{ id: string }>({ rateLimit: RATE_LIMITS.ai }, async (req, { user, params }) => {
  const { instructions } = await parseBody(req, GenerateReplySchema);
  return { draft: await generateReplyDraft({ userId: user.id, emailId: params.id, source: "pipeline", instructions }) };
});
