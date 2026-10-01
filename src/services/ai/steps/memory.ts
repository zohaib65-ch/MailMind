import "server-only";
import { formatEmailForPrompt, memoryPrompt, type PromptEmail } from "@/lib/langchain/prompts";
import { invokeStructured } from "@/lib/langchain/structured";
import type { ThreadMemory } from "@/lib/db/models";
import { ThreadMemoryOutputSchema } from "@/schemas/ai";
import type { StepUser } from "./types";

/**
 * Pipeline step: Memory. Folds one new message into the thread's rolling memory
 * (summary, facts, commitments, open questions). Runs for messages the user sent too —
 * "Yes, Friday works" is exactly the kind of thing worth remembering.
 */
export async function updateThreadMemory(
  user: StepUser,
  previous: ThreadMemory | undefined,
  email: PromptEmail,
  direction: "inbound" | "outbound",
) {
  const previousMemory = previous
    ? JSON.stringify({
        summary: previous.summary,
        facts: previous.facts,
        commitments: previous.commitments.map((c) => ({ by: c.by, text: c.text, due: c.due })),
        openQuestions: previous.openQuestions,
      })
    : "none";

  const result = await invokeStructured({
    purpose: "memory",
    name: "thread_memory",
    schema: ThreadMemoryOutputSchema,
    prompt: memoryPrompt,
    variables: {
      userName: user.name,
      previousMemory,
      direction: direction === "outbound" ? `sent by ${user.name} (the user)` : `received from ${email.from.name ?? email.from.email}`,
      email: formatEmailForPrompt(email, 8_000),
    },
  });
  const m = result.data;
  return {
    ...result,
    data: {
      summary: m.summary,
      facts: m.facts.slice(0, 8),
      commitments: m.commitments.slice(0, 6),
      openQuestions: m.openQuestions.slice(0, 4),
    },
  };
}
