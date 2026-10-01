import "server-only";
import { classificationPrompt, formatEmailForPrompt, today, type PromptEmail } from "@/lib/langchain/prompts";
import { invokeStructured } from "@/lib/langchain/structured";
import { ClassificationOutputSchema } from "@/schemas/ai";
import type { StepUser } from "./types";

/** Pipeline step: AI Classifier. One structured-output call → category, confidence, needsReply. */
export async function classifyEmail(user: StepUser, email: PromptEmail) {
  return invokeStructured({
    purpose: "classify",
    name: "email_classification",
    schema: ClassificationOutputSchema,
    prompt: classificationPrompt,
    variables: {
      userName: user.name,
      userEmail: user.email,
      today: today(),
      // Classification rarely needs the whole body; a shorter cap saves tokens.
      email: formatEmailForPrompt(email, 6_000),
    },
  });
}
