import { after } from "next/server";
import { apiRoute } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { resetMockData } from "@/services/email/account.service";
import { syncUser } from "@/services/email/sync.service";
import { runPostSyncJobs } from "@/services/jobs";

/** Wipes the demo mailbox and AI history, then re-syncs the fixtures. */
export const POST = apiRoute({ rateLimit: RATE_LIMITS.sync }, async (_req, { user }) => {
  await resetMockData(user.id);
  await syncUser(user.id);
  after(() => runPostSyncJobs(user.id));
  return { ok: true };
});
