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

/** A label/read/star change to a message MailMind already has. */
export type MailboxStateUpdate = Pick<ProviderMessage, "providerMessageId" | "labels" | "isRead" | "isImportant" | "isArchived">;

/** What changed in the mailbox since a sync cursor. */
export type ChangesResult =
  | {
      status: "ok";
      /** Newly arrived (or newly sent) messages, fully fetched. */
      messages: ProviderMessage[];
      updates: MailboxStateUpdate[];
      /** Messages permanently deleted from the mailbox. */
      removedIds: string[];
      /** Cursor to pass next time. */
      cursor: string;
    }
  /** The cursor is too old for the provider to replay; do a windowed full sync instead. */
  | { status: "expired" };

/**
 * Everything MailMind is allowed to do to a mailbox. The AI never talks to a provider
 * directly — only through services that call these methods — so this interface is also
 * the outer boundary of what the AI can affect. Note there is no delete.
 */
export interface EmailProvider {
  readonly name: EmailProviderName;
  /** Messages received after `since` (newest first), one page at a time. */
  listMessages(options: { since: Date; maxResults: number; pageToken?: string }): Promise<ListMessagesResult>;
  /** The mailbox's current position in its change log (Gmail: historyId). */
  getSyncCursor(): Promise<string>;
  /** Everything that changed since `cursor` — this is what makes frequent syncs cheap. */
  listChanges(cursor: string, options: { maxMessages: number }): Promise<ChangesResult>;
  sendMessage(message: OutgoingMessage): Promise<SentMessage>;
  setArchived(providerMessageId: string, archived: boolean): Promise<void>;
  setImportant(providerMessageId: string, important: boolean): Promise<void>;
  setRead(providerMessageId: string, read: boolean): Promise<void>;
}
