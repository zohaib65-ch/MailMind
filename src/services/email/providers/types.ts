import type { EmailAddress, EmailProviderName } from "@/schemas/common";

/** A message as fetched from a provider, before it is parsed and stored. */
export type ProviderMessage = {
  providerMessageId: string;
  providerThreadId: string;
  messageIdHeader?: string;
  inReplyTo?: string;
  references: string[];
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  date: Date;
  textBody?: string;
  htmlBody?: string;
  labels: string[];
  isRead: boolean;
  isImportant: boolean;
  isArchived: boolean;
};

export type OutgoingMessage = {
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  textBody: string;
  /** Threading headers so the reply lands in the right conversation. */
  inReplyTo?: string;
  references?: string[];
  providerThreadId?: string;
};

export type SentMessage = {
  providerMessageId: string;
  providerThreadId: string;
  messageIdHeader?: string;
};

export type ListMessagesResult = {
  messages: ProviderMessage[];
  nextPageToken?: string;
};

/**
 * Everything MailMind is allowed to do to a mailbox. The AI never talks to a provider
 * directly — only through services that call these methods — so this interface is also
 * the outer boundary of what the AI can affect. Note there is no delete.
 */
export interface EmailProvider {
  readonly name: EmailProviderName;
  listMessages(options: { since?: Date; maxResults: number; pageToken?: string }): Promise<ListMessagesResult>;
  sendMessage(message: OutgoingMessage): Promise<SentMessage>;
  setArchived(providerMessageId: string, archived: boolean): Promise<void>;
  setImportant(providerMessageId: string, important: boolean): Promise<void>;
  setRead(providerMessageId: string, read: boolean): Promise<void>;
}
