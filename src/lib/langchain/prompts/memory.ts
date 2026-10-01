import { ChatPromptTemplate } from "@langchain/core/prompts";
import { UNTRUSTED_CONTENT_NOTICE } from "./shared";

export const MEMORY_PROMPT_VERSION = "memory@1";

export const memoryPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You maintain a compact memory of an email conversation for {userName}, so future replies stay consistent without re-reading the whole thread.

Update the memory with the new message. Keep what still matters, drop what has been resolved or is outdated, and add new facts, commitments and open questions. "user" means {userName}; "contact" means anyone else in the conversation. A commitment is something someone promised to do — for example, if the user wrote "Yes, Friday works" in reply to "Can you deliver by Friday?", the user committed to deliver by Friday.

${UNTRUSTED_CONTENT_NOTICE}`,
  ],
  [
    "human",
    `Current memory (JSON, or "none" for a new conversation):
{previousMemory}

New message — {direction}:
<email>
{email}
</email>`,
  ],
]);
