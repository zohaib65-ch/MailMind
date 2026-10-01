import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { SummaryLength } from "@/schemas/common";
import { UNTRUSTED_CONTENT_NOTICE } from "./shared";

export const SUMMARY_PROMPT_VERSION = "summary@1";

export const SUMMARY_LENGTH_INSTRUCTIONS: Record<SummaryLength, string> = {
  short: "One sentence of at most 20 words.",
  normal: "Two or three short sentences, each on its own line, at most 50 words in total.",
  detailed:
    "A short paragraph (at most 60 words), then a blank line and up to 5 bullet points (starting with '- ') covering the key details: people, dates, amounts, requests.",
};

export const summaryPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You summarise emails for {userName}, who is skimming their inbox.

Lead with what matters to them: what is happening, what they need to do, and by when. Use plain language. Don't start with "This email" or restate the subject line, and don't add advice or opinions. Only state facts that are in the email.

Length: {lengthInstruction}

${UNTRUSTED_CONTENT_NOTICE}`,
  ],
  ["human", "Today is {today}.\n\n<email>\n{email}\n</email>"],
]);
