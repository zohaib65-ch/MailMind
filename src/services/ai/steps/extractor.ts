import "server-only";
import { extractionPrompt, formatEmailForPrompt, today, type PromptEmail } from "@/lib/langchain/prompts";
import { invokeStructured } from "@/lib/langchain/structured";
import { bodyForAi } from "@/lib/utils/email-text";
import { ExtractedInformationSchema } from "@/schemas/ai";
import { groundExtraction } from "./grounding";
import type { StepUser } from "./types";

/**
 * Pipeline step: Information Extractor. LLM structured extraction, then a grounding pass
 * that removes any value not present in the email (see grounding.ts).
 */
export async function extractInformation(user: StepUser, email: PromptEmail) {
  const result = await invokeStructured({
    purpose: "extract",
    name: "email_extraction",
    schema: ExtractedInformationSchema,
    prompt: extractionPrompt,
    variables: { userName: user.name, userEmail: user.email, today: today(), email: formatEmailForPrompt(email) },
  });
  // Ground against exactly what the model saw (headers + cleaned body).
  const source = `${email.subject}\n${email.from.name ?? ""} ${email.from.email}\n${bodyForAi(email.bodyText)}`;
  const grounded = groundExtraction(result.data, source);
  return { ...result, data: grounded.extracted, dropped: grounded.dropped };
}
