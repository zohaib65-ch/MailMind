import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/services/auth/dal";
import type { SessionUser } from "@/services/auth/session.service";
import { getEnv } from "./env";
import { AppError, ForbiddenError, RateLimitError, ValidationError } from "./errors";
import { createLogger } from "./logger";
import { enforceRateLimit, RATE_LIMITS, type RateLimitRule } from "./rate-limit";

const log = createLogger("api");

/**
 * Route handler wrapper. Every API route goes through this, which gives them all:
 *  - authentication (unless `public: true`)
 *  - CSRF protection: state-changing requests must come from our own origin
 *  - rate limiting per user (or per IP for public routes)
 *  - one consistent JSON error format, without leaking internals on 500s
 */
type RouteOptions = { public?: boolean; rateLimit?: RateLimitRule };
type HandlerContext<P> = { user: SessionUser; params: P };
type PublicHandlerContext<P> = { user: SessionUser | null; params: P };

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Browsers always send Origin on cross-site POSTs; a missing header means a non-browser
    // client (curl, server-to-server), which can't ride on the user's cookies anyway.
    if (req.headers.get("sec-fetch-site") === "cross-site") throw new ForbiddenError("Cross-site request blocked");
    return;
  }
  const allowed = new Set([new URL(getEnv().APP_URL).origin, req.nextUrl.origin]);
  if (!allowed.has(origin)) throw new ForbiddenError("Cross-site request blocked");
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    const res = NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
    if (err instanceof RateLimitError) res.headers.set("Retry-After", String(err.retryAfterSeconds));
    return res;
  }
  log.error("Unhandled API error", { error: err instanceof Error ? { message: err.message, stack: err.stack } : err });
  return NextResponse.json({ error: { code: "internal_error", message: "Something went wrong" } }, { status: 500 });
}

export function apiRoute<P = Record<string, string>>(
  options: RouteOptions & { public: true },
  handler: (req: NextRequest, ctx: PublicHandlerContext<P>) => Promise<unknown>,
): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;
export function apiRoute<P = Record<string, string>>(
  options: RouteOptions,
  handler: (req: NextRequest, ctx: HandlerContext<P>) => Promise<unknown>,
): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;
export function apiRoute<P>(
  options: RouteOptions,
  handler: (req: NextRequest, ctx: HandlerContext<P> & PublicHandlerContext<P>) => Promise<unknown>,
) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      if (MUTATING.has(req.method)) assertSameOrigin(req);
      const user = options.public ? null : await requireApiUser();
      const rule = options.rateLimit ?? (MUTATING.has(req.method) ? RATE_LIMITS.write : RATE_LIMITS.read);
      await enforceRateLimit(rule, user ? `u:${user.id}` : `ip:${clientIp(req)}`);
      const result = await handler(req, { user: user as SessionUser, params: await ctx.params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function parseBody<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const result = schema.safeParse(json);
  if (!result.success) throw new ValidationError("Invalid request body", z.flattenError(result.error));
  return result.data;
}

export function parseQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.infer<S> {
  const result = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!result.success) throw new ValidationError("Invalid query parameters", z.flattenError(result.error));
  return result.data;
}

/**
 * Server-Sent Events from an async generator. Each yielded object becomes one
 * `data: {...}` line. Errors become a final `{ type: "error" }` event so the client can
 * show them instead of seeing a dropped connection.
 */
export function sseResponse(events: AsyncGenerator<object>, onError?: (err: unknown) => object): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        for await (const event of events) send(event);
      } catch (err) {
        if (!(err instanceof AppError)) log.error("Stream failed", { error: err instanceof Error ? err.message : err });
        send(
          onError?.(err) ?? {
            type: "error",
            message: err instanceof AppError ? err.message : "Something went wrong",
            code: err instanceof AppError ? err.code : "internal_error",
          },
        );
      } finally {
        controller.close();
      }
    },
    async cancel() {
      await events.return?.(undefined);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
