import { after } from "next/server";
import { apiRoute, parseBody, sseResponse } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { ResumeRequestSchema } from "@/schemas/api";
import { streamAgentResume } from "@/services/agent/run";
import { runPostSyncJobs } from "@/services/jobs";

export const maxDuration = 300;

/**
 * The user's answer to "send this email?". Approving here is the explicit approval that
 * lets the paused sendEmail tool continue; rejecting resumes the agent without sending.
 */
export const POST = apiRoute({ rateLimit: RATE_LIMITS.assistant }, async (req, { user }) => {
  const body = await parseBody(req, ResumeRequestSchema);
  // If the email gets sent, index it and update the thread memory afterwards.
  if (body.decision === "approve") after(() => runPostSyncJobs(user.id));
  return sseResponse(streamAgentResume({ userId: user.id, ...body, signal: req.signal }));
});
