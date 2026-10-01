import { apiRoute, parseBody } from "@/lib/utils/http";
import { EmailPatchSchema } from "@/schemas/api";
import { getLatestDraftForEmail } from "@/services/email/draft.service";
import {
  getEmailDetail,
  setEmailArchived,
  setEmailImportant,
  setEmailRead,
  setReplyHandled,
} from "@/services/email/email.service";

export const GET = apiRoute<{ id: string }>({}, async (_req, { user, params }) => {
  const [email, draft] = await Promise.all([getEmailDetail(user.id, params.id), getLatestDraftForEmail(user.id, params.id)]);
  return { email, draft };
});

/** Mailbox actions: read/unread, archive, important, and "I've handled this". */
export const PATCH = apiRoute<{ id: string }>({}, async (req, { user, params }) => {
  const body = await parseBody(req, EmailPatchSchema);
  if (body.isRead !== undefined) await setEmailRead(user.id, params.id, body.isRead);
  if (body.isArchived !== undefined) await setEmailArchived(user.id, params.id, body.isArchived);
  if (body.isImportant !== undefined) await setEmailImportant(user.id, params.id, body.isImportant);
  if (body.replyHandled) await setReplyHandled(user.id, params.id);
  return { ok: true };
});
