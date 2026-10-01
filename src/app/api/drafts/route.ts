import { z } from "zod";
import { apiRoute, parseBody, parseQuery } from "@/lib/utils/http";
import { CreateDraftSchema } from "@/schemas/api";
import { DRAFT_STATUSES } from "@/schemas/common";
import { createDraft, listDrafts } from "@/services/email/draft.service";

const ListSchema = z.object({ status: z.enum(DRAFT_STATUSES).optional() });

export const GET = apiRoute({}, async (req, { user }) => {
  const { status } = parseQuery(req, ListSchema);
  return { drafts: await listDrafts(user.id, status ? [status] : undefined) };
});

/** A draft written by the user (manual reply / compose). */
export const POST = apiRoute({}, async (req, { user }) => {
  const body = await parseBody(req, CreateDraftSchema);
  return { draft: await createDraft({ userId: user.id, ...body, source: "user" }) };
});
