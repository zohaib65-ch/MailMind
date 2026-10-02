import { after, NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/utils/env";
import { AiNotConfiguredError } from "@/lib/utils/errors";
import { apiRoute } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { processPendingEmails } from "@/services/ai/processing.service";

/** Queues AI processing for every pending email; returns immediately (202). */
export const POST = apiRoute({ rateLimit: RATE_LIMITS.ai }, async (_req, { user }) => {
  if (!isAiConfigured()) throw new AiNotConfiguredError();
  after(() => processPendingEmails(user.id, { limit: 100 }));
  return NextResponse.json({ queued: true }, { status: 202 });
});
