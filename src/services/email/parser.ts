import { htmlToText, makeSnippet, normalizeWhitespace, stripQuotedReply } from "@/lib/utils/email-text";
import type { EmailAddress } from "@/schemas/common";
import type { ProviderMessage } from "./providers/types";

/**
 * Step 1 of the pipeline: the Email Parser.
 *
 * Turns a provider-specific message into the normalised shape MailMind stores. This step
 * is deterministic (no AI): bodies become plain text, addresses are lower-cased, and the
 * direction (sent by the user vs received) is worked out from the account address.
 */
export type ParsedEmail = {
  providerMessageId: string;
  providerThreadId: string;
  messageIdHeader?: string;
  inReplyTo?: string;
  references: string[];
  direction: "inbound" | "outbound";
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  bodyText: string;
  snippet: string;
  receivedAt: Date;
  labels: string[];
  isRead: boolean;
  isImportant: boolean;
  isArchived: boolean;
};

export function parseProviderMessage(message: ProviderMessage): ParsedEmail {
  const bodyText = message.textBody?.trim()
    ? normalizeWhitespace(message.textBody)
    : message.htmlBody
      ? normalizeWhitespace(htmlToText(message.htmlBody))
      : "";

  const fromEmail = message.from.email.toLowerCase();
  // Decide direction from the provider's SENT label, never from the From header: anyone can
  // forge "From: you", and a forged email must not be treated as something the user wrote.
  const direction = message.labels.includes("SENT") ? "outbound" : "inbound";

  return {
    providerMessageId: message.providerMessageId,
    providerThreadId: message.providerThreadId,
    messageIdHeader: message.messageIdHeader,
    inReplyTo: message.inReplyTo,
    references: message.references,
    direction,
    from: { ...message.from, email: fromEmail },
    to: message.to,
    cc: message.cc,
    subject: message.subject.trim() || "(no subject)",
    bodyText,
    snippet: makeSnippet(stripQuotedReply(bodyText) || bodyText),
    receivedAt: message.date,
    labels: message.labels,
    // The user has obviously "read" what they sent.
    isRead: direction === "outbound" ? true : message.isRead,
    isImportant: message.isImportant,
    isArchived: message.isArchived,
  };
}
