import "server-only";
import { ChatGoogle } from "@langchain/google";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { getEnv, getGeminiApiKey } from "@/lib/utils/env";
import { AiNotConfiguredError } from "@/lib/utils/errors";

/**
 * Every LLM call in MailMind goes through getChatModel(purpose). The purpose decides the
 * model tier, how much the model "thinks", and the output budget:
 *
 *  - Pipeline steps (classify, extract, …) are small, well-specified tasks. They run on the
 *    fast, cheap pipeline model (Gemini Flash-Lite by default) with minimal thinking.
 *  - Writing replies, answering questions and running the agent need more care. They run
 *    on the main model (Gemini Flash by default) with more thinking.
 *
 * Thinking stays internal — MailMind never displays it (the UI only shows tool activity).
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

type ThinkingLevel = "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";

const PURPOSES: Record<ModelPurpose, { tier: "pipeline" | "main"; thinking: ThinkingLevel; maxTokens: number }> = {
  classify: { tier: "pipeline", thinking: "LOW", maxTokens: 4_000 },
  extract: { tier: "pipeline", thinking: "LOW", maxTokens: 8_000 },
  summarize: { tier: "pipeline", thinking: "LOW", maxTokens: 4_000 },
  urgency: { tier: "pipeline", thinking: "LOW", maxTokens: 4_000 },
  memory: { tier: "pipeline", thinking: "LOW", maxTokens: 8_000 },
  draft: { tier: "main", thinking: "MEDIUM", maxTokens: 16_000 },
  rag: { tier: "main", thinking: "LOW", maxTokens: 16_000 },
  agent: { tier: "main", thinking: "MEDIUM", maxTokens: 16_000 },
};

export type ChatModelFactory = (purpose: ModelPurpose) => BaseChatModel;

// Test seam: tests swap in a scripted model so the pipeline and agent can be exercised
// deterministically, without network calls.
let override: ChatModelFactory | null = null;
export function setChatModelFactory(factory: ChatModelFactory | null) {
  override = factory;
}

export function modelNameFor(purpose: ModelPurpose): string {
  const env = getEnv();
  return PURPOSES[purpose].tier === "pipeline" ? env.GEMINI_PIPELINE_MODEL : env.GEMINI_MODEL;
}

/** `thinkingLevel` exists on Gemini 3 and later; older models reject it. */
function supportsThinkingLevel(model: string): boolean {
  const version = /^gemini-(\d+)/.exec(model);
  return version ? Number(version[1]) >= 3 : /-latest$/.test(model);
}

export function getChatModel(purpose: ModelPurpose): BaseChatModel {
  if (override) return override(purpose);
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new AiNotConfiguredError();

  const config = PURPOSES[purpose];
  const model = modelNameFor(purpose);
  return new ChatGoogle({
    model,
    apiKey,
    maxOutputTokens: config.maxTokens,
    // Free-tier Gemini keys hit per-minute limits quickly; retry 429/503 with backoff.
    maxRetries: 6,
    ...(supportsThinkingLevel(model) ? { thinkingLevel: config.thinking } : {}),
  });
}
