import { after, NextResponse } from "next/server";
import { apiRoute } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { indexPendingEmails } from "@/services/embeddings/indexer";

export const POST = apiRoute({ rateLimit: RATE_LIMITS.sync }, async (_req, { user }) => {
  after(() => indexPendingEmails(user.id));
  return NextResponse.json({ queued: true }, { status: 202 });
});
