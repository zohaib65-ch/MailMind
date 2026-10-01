import "server-only";
import { randomToken } from "@/lib/utils/crypto";
import { createLogger } from "@/lib/utils/logger";
import { MOCK_EMAILS, MOCK_INCOMING, MOCK_USER, mockMessageIdHeader, type MockEmailFixture } from "../mock/fixtures";
import type { EmailProvider, ListMessagesResult, OutgoingMessage, ProviderMessage, SentMessage } from "./types";

const log = createLogger("mock-provider");
const ALL_FIXTURES = new Map([...MOCK_EMAILS, ...MOCK_INCOMING].map((f) => [f.id, f]));

function referencesFor(fixture: MockEmailFixture): string[] {
  const chain: string[] = [];
  let parentId = fixture.replyTo;
  while (parentId) {
    chain.unshift(mockMessageIdHeader(parentId));
    parentId = ALL_FIXTURES.get(parentId)?.replyTo;
  }
  return chain;
}

export function fixtureToProviderMessage(fixture: MockEmailFixture, now = Date.now()): ProviderMessage {
  const outbound = fixture.from.email === MOCK_USER.email;
  return {
    providerMessageId: fixture.id,
    providerThreadId: fixture.threadId,
    messageIdHeader: mockMessageIdHeader(fixture.id),
    inReplyTo: fixture.replyTo ? mockMessageIdHeader(fixture.replyTo) : undefined,
    references: referencesFor(fixture),
    from: fixture.from,
    to: fixture.to ?? [MOCK_USER],
    cc: fixture.cc ?? [],
    subject: fixture.subject,
    date: new Date(now - fixture.hoursAgo * 3_600_000),
    textBody: fixture.body,
    labels: outbound ? ["SENT"] : ["INBOX"],
    isRead: fixture.isRead ?? false,
    isImportant: false,
    isArchived: false,
  };
}

/**
 * Mock Email Mode: an in-repo inbox that behaves like a provider, so the whole app (sync,
 * AI pipeline, agent, approval flow) works without connecting a real account.
 * "Sending" only records the message in MailMind — nothing leaves the machine.
 */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock" as const;

  async listMessages(): Promise<ListMessagesResult> {
    const now = Date.now();
    return { messages: MOCK_EMAILS.map((f) => fixtureToProviderMessage(f, now)) };
  }

  async sendMessage(message: OutgoingMessage): Promise<SentMessage> {
    const id = `mock-sent-${randomToken(9)}`;
    log.info("Mock send (not delivered anywhere)", { to: message.to.map((t) => t.email), subject: message.subject });
    return {
      providerMessageId: id,
      providerThreadId: message.providerThreadId ?? `t-${id}`,
      messageIdHeader: mockMessageIdHeader(id),
    };
  }

  async setArchived(): Promise<void> {}
  async setImportant(): Promise<void> {}
  async setRead(): Promise<void> {}
}
