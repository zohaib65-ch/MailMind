import { apiRoute, parseBody } from "@/lib/utils/http";
import { DraftEditSchema } from "@/schemas/api";
import { discardDraft, getDraft, updateDraft } from "@/services/email/draft.service";

export const GET = apiRoute<{ id: string }>({}, async (_req, { user, params }) => ({ draft: await getDraft(user.id, params.id) }));

export const PATCH = apiRoute<{ id: string }>({}, async (req, { user, params }) => ({
  draft: await updateDraft(user.id, params.id, await parseBody(req, DraftEditSchema)),
}));

export const DELETE = apiRoute<{ id: string }>({}, async (_req, { user, params }) => {
  await discardDraft(user.id, params.id);
  return { ok: true };
});
