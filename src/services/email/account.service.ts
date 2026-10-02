import "server-only";
import { connectDb, isObjectId, toObjectId } from "@/lib/db/mongoose";
import { AiDraft, AiTask, Email, EmailAccount, EmailThread, User, type IEmailAccount, type IUser } from "@/lib/db/models";
import { encrypt } from "@/lib/utils/crypto";
import { NotFoundError } from "@/lib/utils/errors";
import type { GoogleIdentity } from "@/services/auth/google-oauth";

export type AccountDTO = {
  id: string;
  provider: IEmailAccount["provider"];
  emailAddress: string;
  lastSyncedAt?: string;
  syncError?: string;
};

export async function listAccounts(userId: string): Promise<AccountDTO[]> {
  await connectDb();
  const accounts = await EmailAccount.find({ userId: toObjectId(userId) }).sort({ createdAt: 1 }).lean();
  return accounts.map((a) => ({
    id: a._id.toString(),
    provider: a.provider,
    emailAddress: a.emailAddress,
    lastSyncedAt: a.sync?.lastSyncedAt?.toISOString(),
    syncError: a.sync?.error ?? undefined,
  }));
}

/** Signs in with Google: creates/updates the user and stores encrypted Gmail tokens. */
export async function upsertGmailUser(identity: GoogleIdentity): Promise<IUser> {
  await connectDb();
  const user = await User.findOneAndUpdate(
    { email: identity.email },
    { $setOnInsert: { email: identity.email }, ...(identity.name ? { $set: { name: identity.name } } : {}) },
    { upsert: true, returnDocument: "after" },
  ).lean();

  const auth: Record<string, unknown> = {
    "auth.accessTokenEnc": encrypt(identity.accessToken),
    "auth.expiresAt": identity.expiresAt,
    "auth.scope": identity.scope,
  };
  // Google only returns a refresh token on first consent; keep the stored one otherwise.
  if (identity.refreshToken) auth["auth.refreshTokenEnc"] = encrypt(identity.refreshToken);

  await EmailAccount.updateOne(
    { userId: user!._id, provider: "gmail", emailAddress: identity.email },
    { $set: { displayName: identity.name, ...auth }, $setOnInsert: { sync: {} } },
    { upsert: true },
  );
  return user as IUser;
}

/** Removes an account and everything MailMind derived from it. Mailbox itself is untouched. */
export async function disconnectAccount(userId: string, accountId: string): Promise<void> {
  await connectDb();
  if (!isObjectId(accountId)) throw new NotFoundError("Email account");
  const account = await EmailAccount.findOne({ _id: toObjectId(accountId), userId: toObjectId(userId) }).lean();
  if (!account) throw new NotFoundError("Email account");
  const emailIds = (await Email.find({ accountId: account._id }).select("_id").lean()).map((e) => e._id);
  await Promise.all([
    AiDraft.deleteMany({ accountId: account._id }),
    EmailThread.deleteMany({ accountId: account._id }),
    AiTask.deleteMany({ emailId: { $in: emailIds } }),
  ]);
  await Email.deleteMany({ accountId: account._id });
  await EmailAccount.deleteOne({ _id: account._id });
}
