import "server-only";
import {
  formatEmailForPrompt,
  SUMMARY_LENGTH_INSTRUCTIONS,
  summaryPrompt,
  today,
  type PromptEmail,
} from "@/lib/langchain/prompts";
import { invokeStructured } from "@/lib/langchain/structured";
import { SummaryOutputSchema } from "@/schemas/ai";
import type { SummaryLength } from "@/schemas/common";
import type { StepUser } from "./types";

/** Pipeline step: Summarizer. The same prompt template serves all three lengths. */
export async function summarizeEmail(user: StepUser, email: PromptEmail, length: SummaryLength) {
  const result = await invokeStructured({
    purpose: "summarize",
    name: `email_summary_${length}`,
    schema: SummaryOutputSchema,
    prompt: summaryPrompt,
    variables: {
      userName: user.name,
      today: today(),
      lengthInstruction: SUMMARY_LENGTH_INSTRUCTIONS[length],
      email: formatEmailForPrompt(email),
    },
  });
  return { ...result, data: result.data.summary.trim() };
}
