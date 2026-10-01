import "server-only";
import { gmail as createGmail, type gmail_v1 } from "@googleapis/gmail";
import { connectDb } from "@/lib/db/mongoose";
import { EmailAccount, type IEmailAccount } from "@/lib/db/models";
import { decrypt, encrypt } from "@/lib/utils/crypto";
import { parseAddressList } from "@/lib/utils/email-text";
import { EmailProviderError, errorMessage } from "@/lib/utils/errors";
import { createLogger } from "@/lib/utils/logger";
import { createOAuthClient } from "@/services/auth/google-oauth";
import { buildMimeMessage } from "../mime";
import type { EmailProvider, ListMessagesResult, OutgoingMessage, ProviderMessage, SentMessage } from "./types";

const log = createLogger("gmail");

/** Gmail system labels we care about. MailMind's "important" maps to Gmail's star. */
const IMPORTANT_LABEL = "STARRED";

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function header(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | undefined {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

function collectBodies(part: gmail_v1.Schema$MessagePart | undefined, out: { text?: string; html?: string }) {
  if (!part) return;
  const mime = part.mimeType ?? "";
  if (part.body?.data && !part.filename) {
    if (mime === "text/plain" && out.text === undefined) out.text = decodeBase64Url(part.body.data);
    if (mime === "text/html" && out.html === undefined) out.html = decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) collectBodies(child, out);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]!);
      }
    }),
  );
  return results;
}

/**
 * Gmail provider. Uses the official Gmail API client with the user's OAuth tokens, which
 * are decrypted only in memory. Refreshed tokens are re-encrypted and saved automatically.
 */
export class GmailProvider implements EmailProvider {
  readonly name = "gmail" as const;
  private readonly gmail: gmail_v1.Gmail;
  private labelNames?: Map<string, string>;

  constructor(private readonly account: Pick<IEmailAccount, "_id" | "emailAddress" | "auth">) {
    if (!account.auth?.accessTokenEnc) throw new EmailProviderError("Gmail account has no stored credentials");
    const client = createOAuthClient();
    client.setCredentials({
      access_token: decrypt(account.auth.accessTokenEnc),
      refresh_token: account.auth.refreshTokenEnc ? decrypt(account.auth.refreshTokenEnc) : undefined,
      expiry_date: account.auth.expiresAt?.getTime(),
    });
    client.on("tokens", (tokens) => {
      void (async () => {
        await connectDb();
        const update: Record<string, unknown> = {};
        if (tokens.access_token) update["auth.accessTokenEnc"] = encrypt(tokens.access_token);
        if (tokens.refresh_token) update["auth.refreshTokenEnc"] = encrypt(tokens.refresh_token);
        if (tokens.expiry_date) update["auth.expiresAt"] = new Date(tokens.expiry_date);
        await EmailAccount.updateOne({ _id: account._id }, { $set: update });
      })().catch((err) => log.error("Failed to persist refreshed Gmail tokens", { error: errorMessage(err) }));
    });
    this.gmail = createGmail({ version: "v1", auth: client });
  }

  private async call<T>(what: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      log.warn(`Gmail ${what} failed`, { error: errorMessage(err) });
      throw new EmailProviderError(`Gmail ${what} failed: ${errorMessage(err)}`);
    }
  }

  private async labelMap(): Promise<Map<string, string>> {
    if (this.labelNames) return this.labelNames;
    const res = await this.call("labels.list", () => this.gmail.users.labels.list({ userId: "me" }));
    this.labelNames = new Map((res.data.labels ?? []).map((l) => [l.id ?? "", l.name ?? l.id ?? ""]));
    return this.labelNames;
  }

  private toProviderMessage(message: gmail_v1.Schema$Message, labels: Map<string, string>): ProviderMessage {
    const headers = message.payload?.headers;
    const bodies: { text?: string; html?: string } = {};
    collectBodies(message.payload, bodies);
    const labelIds = message.labelIds ?? [];
    const from = parseAddressList(header(headers, "From"))[0] ?? { email: "unknown@unknown" };
    const date = header(headers, "Date");
    return {
      providerMessageId: message.id ?? "",
      providerThreadId: message.threadId ?? message.id ?? "",
      messageIdHeader: header(headers, "Message-ID") ?? header(headers, "Message-Id"),
      inReplyTo: header(headers, "In-Reply-To"),
      references: (header(headers, "References") ?? "").split(/\s+/).filter(Boolean),
      from,
      to: parseAddressList(header(headers, "To")),
      cc: parseAddressList(header(headers, "Cc")),
      subject: header(headers, "Subject") ?? "",
      date: message.internalDate ? new Date(Number(message.internalDate)) : date ? new Date(date) : new Date(),
      textBody: bodies.text,
      htmlBody: bodies.html,
      labels: labelIds.map((id) => labels.get(id) ?? id),
      isRead: !labelIds.includes("UNREAD"),
      isImportant: labelIds.includes(IMPORTANT_LABEL),
      isArchived: !labelIds.includes("INBOX") && !labelIds.includes("SENT"),
    };
  }

  async listMessages(options: { since?: Date; maxResults: number; pageToken?: string }): Promise<ListMessagesResult> {
    const query = [
      options.since ? `after:${Math.floor(options.since.getTime() / 1000)}` : "newer_than:30d",
      "-in:chats",
      "-in:spam",
      "-in:trash",
    ].join(" ");
    const list = await this.call("messages.list", () =>
      this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: Math.min(options.maxResults, 100),
        pageToken: options.pageToken,
      }),
    );
    const ids = (list.data.messages ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
    const labels = await this.labelMap();
    const messages = await mapLimit(ids, 5, async (id) => {
      const res = await this.call("messages.get", () => this.gmail.users.messages.get({ userId: "me", id, format: "full" }));
      return this.toProviderMessage(res.data, labels);
    });
    return { messages, nextPageToken: list.data.nextPageToken ?? undefined };
  }

  async sendMessage(message: OutgoingMessage): Promise<SentMessage> {
    const raw = Buffer.from(buildMimeMessage(message), "utf8").toString("base64url");
    const res = await this.call("messages.send", () =>
      this.gmail.users.messages.send({ userId: "me", requestBody: { raw, threadId: message.providerThreadId } }),
    );
    const id = res.data.id ?? "";
    // Fetch the Message-ID header Gmail assigned, so later replies thread correctly.
    const sent = await this.call("messages.get", () =>
      this.gmail.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["Message-ID"] }),
    );
    return {
      providerMessageId: id,
      providerThreadId: res.data.threadId ?? id,
      messageIdHeader: header(sent.data.payload?.headers, "Message-ID"),
    };
  }

  private modify(id: string, add: string[], remove: string[]) {
    return this.call("messages.modify", () =>
      this.gmail.users.messages.modify({ userId: "me", id, requestBody: { addLabelIds: add, removeLabelIds: remove } }),
    );
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    await (archived ? this.modify(id, [], ["INBOX"]) : this.modify(id, ["INBOX"], []));
  }

  async setImportant(id: string, important: boolean): Promise<void> {
    await (important ? this.modify(id, [IMPORTANT_LABEL], []) : this.modify(id, [], [IMPORTANT_LABEL]));
  }

  async setRead(id: string, read: boolean): Promise<void> {
    await (read ? this.modify(id, [], ["UNREAD"]) : this.modify(id, ["UNREAD"], []));
  }
}
