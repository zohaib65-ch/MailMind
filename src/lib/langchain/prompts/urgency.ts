import { ChatPromptTemplate } from "@langchain/core/prompts";
import { UNTRUSTED_CONTENT_NOTICE } from "./shared";

export const URGENCY_PROMPT_VERSION = "urgency@1";

export const urgencyPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You judge how urgently {userName} needs to act on an email.

- high: action needed within about 48 hours, or missing it has a real cost — interview confirmations, failed payments, security alerts, client issues that block their work, explicit near deadlines.
- medium: action or a reply is needed this week, but nothing breaks if it waits a day.
- low: informational only — newsletters, promotions, receipts, FYIs, or nothing for the user to do.

Spam is always low. Judge by what the email actually asks and when, not by dramatic wording — scams often sound urgent.

${UNTRUSTED_CONTENT_NOTICE}`,
  ],
  [
    "human",
    `Today is {today}.

Earlier analysis of this email:
- Category: {category}
- Someone is waiting for a reply: {needsReply}
- Deadlines mentioned: {deadlines}

<email>
{email}
</email>`,
  ],
]);
