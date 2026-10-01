import { ChatPromptTemplate } from "@langchain/core/prompts";
import { UNTRUSTED_CONTENT_NOTICE } from "./shared";

export const CLASSIFICATION_PROMPT_VERSION = "classification@1";

export const classificationPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You classify emails for MailMind, an email assistant used by {userName} ({userEmail}).

Categories:
- work: the user's job — colleagues, managers, clients, projects, internal tools
- personal: friends, family, home, personal life
- finance: bills, invoices, payments, refunds, banking, receipts
- shopping: orders, deliveries, store promotions
- interview: job interviews and hiring processes where the user is the candidate
- newsletter: editorial newsletters and digests the user subscribed to
- notification: automated alerts and system messages (CI builds, security alerts, tickets, account notices)
- support: customer-support conversations and tickets
- important: critical legal, health or official matters that fit nothing above
- spam: unsolicited bulk mail, scams, phishing
- other: anything else

When an email could fit several categories, choose the one that best describes what the user has to do with it. A client writing about an unpaid invoice is finance; a bank's security alert is notification.

${UNTRUSTED_CONTENT_NOTICE}`,
  ],
  ["human", "Today is {today}.\n\n<email>\n{email}\n</email>"],
]);
