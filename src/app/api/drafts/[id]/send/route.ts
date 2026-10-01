import { after } from "next/server";
import { apiRoute, parseBody } from "@/lib/utils/http";
import { SendDraftSchema } from "@/schemas/api";
import { approveAndSendDraft } from "@/services/email/draft.service";
import { runPostSyncJobs } from "@/services/jobs";

/**
 * The human approval step. The user clicked "Send" on a draft they reviewed (optionally
 * with final edits); `confirm: true` must be present in the body.
 */
export const POST = apiRoute<{ id: string }>({}, async (req, { user, params }) => {
  const { to, cc, subject, body } = await parseBody(req, SendDraftSchema);
  const draft = await approveAndSendDraft(user.id, params.id, { to, cc, subject, body });
  // The sent reply is a new message in the thread: embed it and fold it into thread memory.
  after(() => runPostSyncJobs(user.id));
  return { draft };
});
