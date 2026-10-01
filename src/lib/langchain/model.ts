import "server-only";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { getEnv } from "@/lib/utils/env";
import { AiNotConfiguredError } from "@/lib/utils/errors";

/**
 * Every LLM call in MailMind goes through getChatModel(purpose). The purpose decides the
 * model tier, the effort level and the output budget:
 *
 *  - Pipeline steps (classify, extract, …) are small, well-specified tasks → effort "low".
 *  - Writing replies, answering questions and running the agent need more care → "medium".
 *
 * Claude Opus 5.5 always thinks adaptively; `effort` is the dial for how much. Thinking
 * stays internal — MailMind never displays it (the UI only shows tool activity).
 */
export type ModelPurpose =
  | "classify"
  | "extract"
  | "summarize"
  | "urgency"
  | "memory"
  | "draft"
  | "rag"
  | "agent";

type Effort = "low" | "medium" | "high";

const PURPOSES: Record<ModelPurpose, { tier: "pipeline" | "main"; effort: Effort; maxTokens: number }> = {
  classify: { tier: "pipeline", effort: "low", maxTokens: 4_000 },
  extract: { tier: "pipeline", effort: "low", maxTokens: 8_000 },
  summarize: { tier: "pipeline", effort: "low", maxTokens: 4_000 },
  urgency: { tier: "pipeline", effort: "low", maxTokens: 4_000 },
  memory: { tier: "pipeline", effort: "low", maxTokens: 8_000 },
  draft: { tier: "main", effort: "medium", maxTokens: 16_000 },
  rag: { tier: "main", effort: "medium", maxTokens: 16_000 },
  agent: { tier: "main", effort: "medium", maxTokens: 16_000 },
};

export type ChatModelFactory = (purpose: ModelPurpose) => BaseChatModel;

// Test seam: unit tests swap in a fake model so the pipeline and agent can be exercised
// without network calls or an API key.
let override: ChatModelFactory | null = null;
export function setChatModelFactory(factory: ChatModelFactory | null) {
  override = factory;
}

export function modelNameFor(purpose: ModelPurpose): string {
  const env = getEnv();
  return PURPOSES[purpose].tier === "pipeline" ? (env.ANTHROPIC_PIPELINE_MODEL ?? env.ANTHROPIC_MODEL) : env.ANTHROPIC_MODEL;
}

export function getChatModel(purpose: ModelPurpose): BaseChatModel {
  if (override) return override(purpose);
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) throw new AiNotConfiguredError();

  const config = PURPOSES[purpose];
  // Server-side refusal fallback: if a safety classifier declines a request, the API
  // retries it on a fallback model inside the same call. Enabled for single-shot calls.
  // The agent is excluded: it replays its history every turn, and LangChain does not
  // round-trip the `fallback` content blocks, which would alter that history.
  const fallbacks = env.ANTHROPIC_REFUSAL_FALLBACKS && purpose !== "agent";

  return new ChatAnthropic({
    model: modelNameFor(purpose),
    apiKey: env.ANTHROPIC_API_KEY,
    maxTokens: config.maxTokens,
    maxRetries: 2,
    outputConfig: { effort: config.effort },
    ...(fallbacks
      ? { betas: ["server-side-fallback-2026-07-01"], invocationKwargs: { fallbacks: "default" } }
      : {}),
  });
}
