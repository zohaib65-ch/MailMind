import "server-only";
import { formatEmailForPrompt, today, urgencyPrompt, type PromptEmail } from "@/lib/langchain/prompts";
import { invokeStructured } from "@/lib/langchain/structured";
import { UrgencyOutputSchema } from "@/schemas/ai";
import type { EmailCategory } from "@/schemas/common";
import type { StepUser } from "./types";

/** Pipeline step: Urgency Detector. Uses the classifier's and extractor's results as context. */
export async function detectUrgency(
  user: StepUser,
  email: PromptEmail,
  context: { category: EmailCategory; needsReply: boolean; deadlines: string[] },
) {
  const result = await invokeStructured({
    purpose: "urgency",
    name: "email_urgency",
    schema: UrgencyOutputSchema,
    prompt: urgencyPrompt,
    variables: {
      userName: user.name,
      today: today(),
      category: context.category,
      needsReply: context.needsReply ? "yes" : "no",
      deadlines: context.deadlines.length ? context.deadlines.join("; ") : "none",
      email: formatEmailForPrompt(email, 6_000),
    },
  });
  const respondBy = result.data.respondBy && /^\d{4}-\d{2}-\d{2}$/.test(result.data.respondBy) ? result.data.respondBy : null;
  return { ...result, data: { ...result.data, reasons: result.data.reasons.slice(0, 3), respondBy } };
}
