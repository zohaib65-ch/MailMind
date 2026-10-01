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

  // ── Gmail (Google OAuth) ──
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  /** How many days of mail the first sync imports. */
  GMAIL_INITIAL_SYNC_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** Upper bound on messages imported by one sync run. */
  GMAIL_SYNC_MAX_MESSAGES: z.coerce.number().int().min(10).max(2000).default(200),
  /** How often open browser tabs ask the server to check Gmail for new mail. 0 = off. */
  GMAIL_POLL_SECONDS: z.coerce.number().int().min(0).default(60),

  // ── AI: Google Gemini ──
  /** Gemini API key from Google AI Studio. GOOGLE_API_KEY is accepted as an alias. */
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  /** Model for the agent, reply drafts and RAG answers. */
  GEMINI_MODEL: z.string().default("gemini-3.5-flash"),
  /** Model for the per-email pipeline steps (classify, extract, summarise, urgency, memory). */
  GEMINI_PIPELINE_MODEL: z.string().default("gemini-3.5-flash-lite"),
  /** Run the AI pipeline automatically after new emails are synced. */
  AI_AUTO_PROCESS: boolish.default(true),
  /**
   * Max emails the automatic pipeline analyses per run (newest first). Keeps a big first
   * Gmail import from burning through the Gemini quota; the rest can be analysed on demand.
   */
  AI_AUTO_PROCESS_LIMIT: z.coerce.number().int().min(0).default(25),

  // ── Embeddings (semantic search) ──
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-2"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
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

/** The Gemini key, from GEMINI_API_KEY or GOOGLE_API_KEY. */
export function getGeminiApiKey(): string | undefined {
  const env = getEnv();
  return env.GEMINI_API_KEY || env.GOOGLE_API_KEY || undefined;
}

export function isAiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

export function isGmailConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
