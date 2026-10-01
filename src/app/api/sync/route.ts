import { after } from "next/server";
import { apiRoute } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { syncUser } from "@/services/email/sync.service";
import { runPostSyncJobs } from "@/services/jobs";

export const maxDuration = 60;

export const POST = apiRoute({ rateLimit: RATE_LIMITS.sync }, async (_req, { user }) => {
  const results = await syncUser(user.id);
  after(() => runPostSyncJobs(user.id));
  return { created: results.reduce((n, r) => n + r.created, 0), accounts: results.length };
});
