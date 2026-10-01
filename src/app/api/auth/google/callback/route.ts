import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { safeEqual } from "@/lib/utils/crypto";
import { errorMessage } from "@/lib/utils/errors";
import { apiRoute } from "@/lib/utils/http";
import { createLogger } from "@/lib/utils/logger";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { exchangeGoogleCode } from "@/services/auth/google-oauth";
import { createSession } from "@/services/auth/session.service";
import { upsertGmailUser } from "@/services/email/account.service";
import { syncUser } from "@/services/email/sync.service";
import { runPostSyncJobs } from "@/services/jobs";

const log = createLogger("google-callback");

export const GET = apiRoute({ public: true, rateLimit: RATE_LIMITS.auth }, async (req) => {
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, req.url));
  const store = await cookies();
  const expected = store.get("mm_oauth_state")?.value;
  store.delete({ name: "mm_oauth_state", path: "/api/auth/google" });

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail("Google sign-in was cancelled");
  const state = params.get("state");
  const code = params.get("code");
  if (!expected || !state || !code || !safeEqual(state, expected)) return fail("Sign-in expired, please try again");

  try {
    const identity = await exchangeGoogleCode(code);
    const user = await upsertGmailUser(identity);
    const userId = user._id.toString();
    await createSession(userId, req.headers.get("user-agent"));
    // First sync and AI processing run after the redirect, so sign-in feels instant.
    after(async () => {
      await syncUser(userId).catch((err) => log.warn("Initial Gmail sync failed", { error: errorMessage(err) }));
      await runPostSyncJobs(userId);
    });
    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (err) {
    log.warn("Google sign-in failed", { error: errorMessage(err) });
    return fail(errorMessage(err));
  }
});
