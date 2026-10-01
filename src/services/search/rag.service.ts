import "server-only";
import { toObjectId } from "@/lib/db/mongoose";
import { Email, type IEmail } from "@/lib/db/models";
import { formatPromptDate, ragPrompt, today } from "@/lib/langchain/prompts";
import { invokeStructured } from "@/lib/langchain/structured";
import { bodyForAi, formatAddressHeader } from "@/lib/utils/email-text";
import { RagAnswerOutputSchema } from "@/schemas/ai";
import { trackAiTask } from "@/services/ai/ai-task.service";
import type { RagAnswerDTO } from "@/types/email";
import { searchEmails } from "./search.service";

/**
 * RAG over the inbox: Retrieve (hybrid search) → Augment (number the emails as sources) →
 * Generate (Gemini answers using only those sources, citing them as [n]).
 *
 * Unlike the agent, this is a fixed chain: one retrieval, one LLM call. Predictable,
 * cheap, and a good baseline to compare the agent against.
 */
export async function answerQuestion(userId: string, userName: string, question: string): Promise<RagAnswerDTO> {
  const { results } = await searchEmails(userId, { query: question, mode: "hybrid", limit: 6 });
  if (!results.length) {
    return { answer: "I couldn't find any emails related to that.", confidence: "low", sources: [] };
  }

  const emails = await Email.find({ _id: { $in: results.map((r) => toObjectId(r.email.id)) } }).lean();
  const byId = new Map(emails.map((e) => [e._id.toString(), e as IEmail]));
  const sources = results
    .map((r, i) => ({ index: i + 1, result: r, email: byId.get(r.email.id) }))
    .filter((s): s is typeof s & { email: IEmail } => Boolean(s.email));

  const sourcesText = sources
    .map(
      (s) =>
        `<source id="${s.index}">\nFrom: ${formatAddressHeader([s.email.from])}\nDate: ${formatPromptDate(s.email.receivedAt)}\nSubject: ${s.email.subject}\n\n${bodyForAi(s.email.bodyText, 2_000)}\n</source>`,
    )
    .join("\n\n");

  const output = await trackAiTask({ userId, type: "rag_answer", input: { question, sources: sources.length } }, async () => {
    const r = await invokeStructured({
      purpose: "rag",
      name: "rag_answer",
      schema: RagAnswerOutputSchema,
      prompt: ragPrompt,
      variables: { userName, today: today(), sources: sourcesText, question },
    });
    return { result: r.data, usage: r.usage, model: r.model };
  });

  const cited = new Set(output.citations);
  const ordered = [...sources].sort((a, b) => Number(cited.has(b.index)) - Number(cited.has(a.index)));
  return {
    answer: output.answer,
    confidence: output.confidence,
    sources: ordered.map((s) => ({
      index: s.index,
      emailId: s.email._id.toString(),
      subject: s.email.subject,
      from: s.email.from,
      receivedAt: s.email.receivedAt.toISOString(),
    })),
  };
}
