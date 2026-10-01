import { apiRoute } from "@/lib/utils/http";
import { disconnectAccount } from "@/services/email/account.service";

/** Disconnects an account and deletes MailMind's copy of its data (the mailbox is untouched). */
export const DELETE = apiRoute<{ id: string }>({}, async (_req, { user, params }) => {
  await disconnectAccount(user.id, params.id);
  return { ok: true };
});
