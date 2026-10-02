import "server-only";
import { formatEmailForPrompt, formatPromptDate, replyPrompt, today, type PromptEmail } from "@/lib/langchain/prompts";
import { invokeStructured } from "@/lib/langchain/structured";
import type { ThreadMemory } from "@/lib/db/models";
import { bodyForAi, replySubject } from "@/lib/utils/email-text";
import { ReplyDraftOutputSchema } from "@/schemas/ai";

export type ReplyContext = {
  user: { name: string; email: string; tone: string; signature?: string };
  email: PromptEmail;
  /** Earlier messages in the thread, oldest first (the email being replied to excluded). */
  earlier: (PromptEmail & { direction: "inbound" | "outbound" })[];
  memory?: ThreadMemory;
  instructions?: string;
};

function formatMemory(memory: ThreadMemory | undefined): string {
  if (!memory) return "No memory yet — this is a new conversation.";
  const lines = [`Summary: ${memory.summary}`];
  if (memory.facts.length) lines.push(`Facts:\n${memory.facts.map((f) => `- ${f}`).join("\n")}`);
  if (memory.commitments.length) {
    lines.push(
      `Commitments:\n${memory.commitments
        .map((c) => `- ${c.by === "user" ? "The user" : "The contact"} committed to: ${c.text}${c.due ? ` (due ${c.due})` : ""}`)
        .join("\n")}`,
    );
  }
  if (memory.openQuestions.length) lines.push(`Open questions:\n${memory.openQuestions.map((q) => `- ${q}`).join("\n")}`);
  return lines.join("\n");
}

/**
 * Pipeline step: Draft Reply. Gets compact context — thread memory plus only the last few
 * messages, shortened — instead of the whole mailbox. The output is a draft for the user to
 * review; this step never sends anything.
 */
export async function draftReply(context: ReplyContext) {
  const recent = context.earlier.slice(-3);
  const thread = recent.length
    ? recent
        .map(
          (m) =>
            `--- ${m.direction === "outbound" ? "The user" : (m.from.name ?? m.from.email)} wrote on ${formatPromptDate(m.receivedAt)} ---\n${bodyForAi(m.bodyText, 1_500)}`,
        )
        .join("\n\n")
    : "(no earlier messages)";

  const signature = context.user.signature?.trim() || context.user.name;

  const result = await invokeStructured({
    purpose: "draft",
    name: "reply_draft",
    schema: ReplyDraftOutputSchema,
    prompt: replyPrompt,
    variables: {
      userName: context.user.name,
      userEmail: context.user.email,
      tone: context.user.tone,
      signature,
      today: today(),
      memory: formatMemory(context.memory),
      thread,
      email: formatEmailForPrompt(context.email),
      instructions: context.instructions?.trim() || "(none)",
    },
  });
  return {
    ...result,
    data: {
      subject: result.data.subject.trim() || replySubject(context.email.subject),
      body: result.data.body.trim(),
      notes: result.data.notes.slice(0, 5),
    },
  };
}
