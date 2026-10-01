import { after } from "next/server";
import { apiRoute } from "@/lib/utils/http";
import { simulateIncomingEmail } from "@/services/email/sync.service";
import { runPostSyncJobs } from "@/services/jobs";

/** Mock Email Mode: deliver the next fixture email, then run embeddings + the AI pipeline. */
export const POST = apiRoute({}, async (_req, { user }) => {
  const delivered = await simulateIncomingEmail(user.id);
  if (delivered) after(() => runPostSyncJobs(user.id));
  return { delivered };
});
