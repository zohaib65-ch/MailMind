import { ChatPromptTemplate } from "@langchain/core/prompts";
import { UNTRUSTED_CONTENT_NOTICE } from "./shared";

export const RAG_PROMPT_VERSION = "rag@1";

/** Retrieval-augmented generation: answer only from the retrieved emails, with citations. */
export const ragPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You answer {userName}'s questions about their email using only the numbered sources provided. Cite sources inline like [1] or [2][3]. If the sources don't contain the answer, say so plainly instead of guessing. Keep the answer short and easy to scan; use a list when there are several items.

${UNTRUSTED_CONTENT_NOTICE}`,
  ],
  ["human", "Today is {today}.\n\nSources:\n{sources}\n\nQuestion: {question}"],
]);
