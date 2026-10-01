import { apiRoute, parseBody } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { AskSchema } from "@/schemas/api";
import { answerQuestion } from "@/services/search/rag.service";

export const maxDuration = 60;

/** RAG: answers a question using only the user's emails, with citations. */
export const POST = apiRoute({ rateLimit: RATE_LIMITS.ai }, async (req, { user }) => {
  const { question } = await parseBody(req, AskSchema);
  return answerQuestion(user.id, user.name, question);
});
