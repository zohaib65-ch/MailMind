import "server-only";
import { OAuth2Client } from "google-auth-library";
import { getEnv, isGmailConfigured } from "@/lib/utils/env";
import { AppError } from "@/lib/utils/errors";

/**
 * Least privilege: `gmail.modify` lets MailMind read mail, change labels (archive, star)
 * and send — but not permanently delete anything. `openid email profile` identify the user.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
];

export function redirectUri(): string {
  const env = getEnv();
  return env.GOOGLE_REDIRECT_URI ?? `${env.APP_URL}/api/auth/google/callback`;
}

export function createOAuthClient(): OAuth2Client {
  if (!isGmailConfigured()) {
    throw new AppError("Gmail is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.", 503, "gmail_not_configured");
  }
  const env = getEnv();
  return new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: redirectUri(),
  });
}

export function buildGoogleAuthUrl(state: string): string {
  return createOAuthClient().generateAuthUrl({
    access_type: "offline", // ask for a refresh token so sync works later without the user
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export type GoogleIdentity = {
  email: string;
  name?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
};

export async function exchangeGoogleCode(code: string): Promise<GoogleIdentity> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token || !tokens.access_token) throw new AppError("Google did not return the expected tokens", 502);

  // Verify the ID token's signature and audience before trusting the email inside it.
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: getEnv().GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) throw new AppError("Google account email is not verified", 403);

  const granted = tokens.scope?.split(" ") ?? [];
  if (!granted.includes("https://www.googleapis.com/auth/gmail.modify")) {
    throw new AppError("MailMind needs Gmail access to work. Please allow it on the Google consent screen.", 403);
  }

  return {
    email: payload.email.toLowerCase(),
    name: payload.name,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? undefined,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    scope: tokens.scope ?? undefined,
  };
}
