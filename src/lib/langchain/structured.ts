import "server-only";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import type { z } from "zod";
import { AiOutputError } from "@/lib/utils/errors";
import { createLogger } from "@/lib/utils/logger";
import { getChatModel, modelNameFor, type ModelPurpose } from "./model";

const log = createLogger("structured-output");

export type TokenUsage = { inputTokens: number; outputTokens: number };

export type StructuredResult<T> = { data: T; usage: TokenUsage; model: string };

function usageOf(message: AIMessage | undefined): TokenUsage {
  return {
    inputTokens: message?.usage_metadata?.input_tokens ?? 0,
    outputTokens: message?.usage_metadata?.output_tokens ?? 0,
  };
}

/** Gemini finish reasons that mean the model blocked the content rather than answering. */
const BLOCKED_FINISH_REASONS = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"]);

/** Finish reasons that mean "there is no usable answer in this response". */
function assertUsableStop(message: AIMessage) {
  const finishReason = message.response_metadata?.finish_reason as string | undefined;
  if (finishReason && BLOCKED_FINISH_REASONS.has(finishReason)) {
    throw new AiOutputError(`The model declined to process this content (${finishReason.toLowerCase()}).`);
  }
  if (finishReason === "MAX_TOKENS") throw new AiOutputError("The model ran out of output tokens before finishing.");
}

function parseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  return JSON.parse(trimmed);
}

/**
 * Prompt template → Gemini → Zod-validated object.
 *
 * Uses LangChain's `withStructuredOutput(schema, { method: "jsonSchema" })`, which sends the
 * schema as Gemini's `responseJsonSchema` (with `responseMimeType: application/json`), so
 * decoding is constrained to it.
 * The result is then validated against the Zod schema. If validation still fails (some
 * constraints are advisory to the model), we retry once and tell the model what was wrong.
 */
export async function invokeStructured<S extends z.ZodType>(options: {
  purpose: ModelPurpose;
  schema: S;
  /** Name for traces, e.g. "email_classification". */
  name: string;
  prompt: ChatPromptTemplate;
  variables: Record<string, unknown>;
}): Promise<StructuredResult<z.infer<S>>> {
  const { purpose, schema, name, prompt, variables } = options;
  const model = getChatModel(purpose);
  const structured = model.withStructuredOutput(schema, { name, method: "jsonSchema", includeRaw: true });

  const messages: BaseMessage[] = await prompt.formatMessages(variables);
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { raw, parsed } = (await structured.invoke(messages, { runName: name })) as {
      raw: AIMessage;
      parsed: z.infer<S> | null;
    };
    const u = usageOf(raw);
    usage.inputTokens += u.inputTokens;
    usage.outputTokens += u.outputTokens;
    assertUsableStop(raw);
    const modelName = modelNameFor(purpose);

    // LangChain already validated `parsed` with the Zod schema; parse again to apply
    // transforms/defaults and to get a precise error message when it is missing.
    const candidate = parsed ?? (() => {
      try {
        return parseJson(raw.text);
      } catch {
        return undefined;
      }
    })();
    const result = schema.safeParse(candidate);
    if (result.success) return { data: result.data, usage, model: modelName };

    const issues = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    log.warn("Structured output failed validation", { name, attempt, issues });
    if (attempt === 2) throw new AiOutputError(`The model returned invalid ${name} output`, { issues });

    messages.push(
      new AIMessage(raw.text || "(no output)"),
      new HumanMessage(`That output did not match the required schema (${issues}). Reply again with corrected JSON only.`),
    );
  }
  throw new AiOutputError(`The model returned invalid ${name} output`);
}
