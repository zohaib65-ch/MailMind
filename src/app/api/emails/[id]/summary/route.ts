import { apiRoute, parseBody } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { SummaryRequestSchema } from "@/schemas/api";
import { getEmailSummary } from "@/services/ai/summary.service";

/** Short / normal / detailed summaries, generated on first request and then cached. */
export const POST = apiRoute<{ id: string }>({ rateLimit: RATE_LIMITS.ai }, async (req, { user, params }) => {
  const { length, regenerate } = await parseBody(req, SummaryRequestSchema);
  return { summary: await getEmailSummary(user.id, params.id, length, { regenerate }) };
});
