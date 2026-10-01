import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomToken } from "@/lib/utils/crypto";
import { getEnv } from "@/lib/utils/env";
import { apiRoute } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { buildGoogleAuthUrl } from "@/services/auth/google-oauth";

/** Starts "Sign in with Google": a random `state` cookie protects the callback from CSRF. */
export const GET = apiRoute({ public: true, rateLimit: RATE_LIMITS.auth }, async () => {
  const state = randomToken(16);
  (await cookies()).set("mm_oauth_state", state, {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return NextResponse.redirect(buildGoogleAuthUrl(state));
});
