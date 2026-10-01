import "server-only";
import { EmailAccount, type IEmailAccount } from "@/lib/db/models";
import { NotFoundError } from "@/lib/utils/errors";
import { GmailProvider } from "./gmail";
import { MockEmailProvider } from "./mock";
import type { EmailProvider } from "./types";

export type { EmailProvider } from "./types";

/** Returns the provider implementation for an account (credentials are loaded here only). */
export async function getProviderForAccount(account: Pick<IEmailAccount, "_id" | "provider">): Promise<EmailProvider> {
  if (account.provider === "mock") return new MockEmailProvider();
  const withAuth = await EmailAccount.findById(account._id).select("+auth").lean();
  if (!withAuth) throw new NotFoundError("Email account");
  return new GmailProvider(withAuth);
}
