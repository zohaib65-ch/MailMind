import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth check (Next.js 16 "proxy", formerly middleware). It only looks for the
 * session cookie — no database access — and redirects signed-out visitors to /login.
 * Real verification happens in the data access layer (services/auth/dal.ts) on every
 * page and API call, so a forged cookie gets nothing.
 */
const SESSION_COOKIE = "mm_session";
const PUBLIC_PATHS = ["/login", "/api/auth/", "/api/health"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (isPublic || hasSession) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { code: "unauthorized", message: "You need to sign in" } }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
