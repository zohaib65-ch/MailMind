import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { UnauthorizedError } from "@/lib/utils/errors";
import { getUserFromSessionToken, SESSION_COOKIE, type SessionUser } from "./session.service";

/**
 * Data Access Layer for authentication. `proxy.ts` only does a cheap "is there a cookie?"
 * check; the real verification (database lookup) happens here, close to the data.
 * `cache` dedupes the lookup within one request/render.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getUserFromSessionToken(token);
});

/** For pages and layouts: redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For route handlers: throws a 401 instead of redirecting. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
