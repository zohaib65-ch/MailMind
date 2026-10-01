import "server-only";
import { EmailAccount, type IEmailAccount } from "@/lib/db/models";
import { NotFoundError } from "@/lib/utils/errors";
import { GmailProvider } from "./gmail";
import type { EmailProvider } from "./types";

export type { EmailProvider } from "./types";

/**
 * Returns the provider implementation for an account. Credentials are loaded only here,
 * and only server-side. Gmail is the only provider today; the EmailProvider interface is
 * where another one (e.g. Microsoft Graph) would plug in.
 */
export async function getProviderForAccount(account: Pick<IEmailAccount, "_id" | "provider">): Promise<EmailProvider> {
  const withAuth = await EmailAccount.findById(account._id).select("+auth").lean();
  if (!withAuth) throw new NotFoundError("Email account");
  return new GmailProvider(withAuth);
}
