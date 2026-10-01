/**
 * Application errors. Route handlers map these to HTTP responses (see lib/utils/http.ts);
 * anything else becomes a generic 500 so internal details never leak to the client.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 500,
    readonly code: string = "internal_error",
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(what = "Resource") {
    super(`${what} not found`, 404, "not_found");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You need to sign in") {
    super(message, 401, "unauthorized");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Not allowed") {
    super(message, 403, "forbidden");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "validation_error", details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "conflict");
  }
}

export class RateLimitError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many requests, slow down a little", 429, "rate_limited");
  }
}

export class AiNotConfiguredError extends AppError {
  constructor() {
    super("AI is not configured. Set ANTHROPIC_API_KEY in your .env file.", 503, "ai_not_configured");
  }
}

/** The model declined, ran out of tokens, or returned output that failed validation. */
export class AiOutputError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 502, "ai_output_error", details);
  }
}

export class EmailProviderError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 502, "email_provider_error", details);
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "Unknown error";
}
