import "server-only";
import { cookies } from "next/headers";
import { connectDb, toObjectId } from "@/lib/db/mongoose";
import { Session, User } from "@/lib/db/models";
import { randomToken, sha256 } from "@/lib/utils/crypto";
import { getEnv } from "@/lib/utils/env";

export const SESSION_COOKIE = "mm_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = { id: string; email: string; name: string };

/**
 * Database-backed sessions. The browser gets a random 256-bit token in an httpOnly cookie;
 * the database stores only its SHA-256 hash, so a database leak doesn't leak live sessions.
 * Signing out deletes the session row, which revokes it immediately.
 */
export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  await connectDb();
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await Session.create({ tokenHash: sha256(token), userId: toObjectId(userId), expiresAt, userAgent: userAgent?.slice(0, 300) });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getUserFromSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  await connectDb();
  const session = await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;
  const user = await User.findById(session.userId).select("email name").lean();
  if (!user) return null;
  return { id: user._id.toString(), email: user.email, name: user.name ?? user.email.split("@")[0]! };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await connectDb();
    await Session.deleteOne({ tokenHash: sha256(token) });
  }
  store.delete(SESSION_COOKIE);
}
