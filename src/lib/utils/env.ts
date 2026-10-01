import "server-only";
import { z } from "zod";

/**
 * Server-side environment, validated once on first use.
 *
 * Nothing in here is ever sent to the browser: secrets are read only by server code
 * (route handlers, server components, services). Client code must use NEXT_PUBLIC_*.
 */
const boolish = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true" || v === "1"));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** IANA time zone used when showing dates to the AI (e.g. "Monday 10 AM"). */
  APP_TIMEZONE: z.string().default("UTC"),

  // ── Database ──
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB: z.string().default("mailmind"),

  // ── Security ──
  /** 32 bytes, base64 or hex. Encrypts OAuth tokens at rest. */
  ENCRYPTION_KEY: z.string().optional(),

  // ── Email ──
  /** Mock mode lets you develop without connecting a real inbox. */
  MOCK_EMAIL_MODE: boolish.default(true),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // ── AI ──
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
  /** Model for the per-email pipeline steps. Defaults to ANTHROPIC_MODEL. */
  ANTHROPIC_PIPELINE_MODEL: z.string().optional(),
  /** Server-side refusal fallbacks for single-shot calls (see lib/langchain/model.ts). */
  ANTHROPIC_REFUSAL_FALLBACKS: boolish.default(true),
  /** Run the AI pipeline automatically after new emails are synced. */
  AI_AUTO_PROCESS: boolish.default(true),

  // ── Embeddings ──
  EMBEDDINGS_PROVIDER: z.enum(["voyage", "mock"]).optional(),
  VOYAGE_API_KEY: z.string().optional(),
  VOYAGE_MODEL: z.string().default("voyage-3.5"),
  VOYAGE_DIMENSIONS: z.coerce.number().int().positive().default(1024),
  ATLAS_VECTOR_INDEX: z.string().default("email_embeddings_vector"),

  // ── Redis (optional) ──
  REDIS_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is required in production.");
  }
  cached = parsed.data;
  return cached;
}

export function isAiConfigured(): boolean {
  return Boolean(getEnv().ANTHROPIC_API_KEY);
}

export function isGmailConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function getEmbeddingsProviderName(): "voyage" | "mock" {
  const env = getEnv();
  return env.EMBEDDINGS_PROVIDER ?? (env.VOYAGE_API_KEY ? "voyage" : "mock");
}
