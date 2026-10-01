import { after, NextResponse } from "next/server";
import { getEnv } from "@/lib/utils/env";
import { ForbiddenError } from "@/lib/utils/errors";
import { apiRoute } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { createSession } from "@/services/auth/session.service";
import { runPostSyncJobs } from "@/services/jobs";
import { getOrCreateDemoUser } from "@/services/email/account.service";
import { syncUser } from "@/services/email/sync.service";

/** Mock Email Mode sign-in: creates the demo user and loads the mock inbox. */
export const POST = apiRoute({ public: true, rateLimit: RATE_LIMITS.auth }, async (req) => {
  if (!getEnv().MOCK_EMAIL_MODE) throw new ForbiddenError("Mock Email Mode is disabled");
  const user = await getOrCreateDemoUser();
  const userId = user._id.toString();
  await syncUser(userId);
  await createSession(userId, req.headers.get("user-agent"));
  after(() => runPostSyncJobs(userId));
  return NextResponse.json({ ok: true });
});
