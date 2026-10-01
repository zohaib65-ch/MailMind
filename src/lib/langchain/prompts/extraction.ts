import { ChatPromptTemplate } from "@langchain/core/prompts";
import { UNTRUSTED_CONTENT_NOTICE } from "./shared";

export const EXTRACTION_PROMPT_VERSION = "extraction@1";

export const extractionPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You extract structured information from emails for {userName} ({userEmail}).

Only extract what is actually written in the email. Never infer, complete or invent a value — if the email has nothing for a field, return an empty array. Copy values exactly as they appear: keep "Monday" as "Monday" rather than converting it to a date, and keep phone numbers and links character for character.

Tasks are the one exception: phrase each as a short instruction for the user (e.g. "Confirm availability for Monday 10 AM"), and only include things the user is asked or expected to do — not things other people will do.

${UNTRUSTED_CONTENT_NOTICE}`,
  ],
  ["human", "Today is {today}.\n\n<email>\n{email}\n</email>"],
]);
