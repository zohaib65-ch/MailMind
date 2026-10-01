import { after } from "next/server";
import { z } from "zod";
import { apiRoute, parseBody } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { syncUser } from "@/services/email/sync.service";
import { runPostSyncJobs } from "@/services/jobs";

export const maxDuration = 120;

const SyncRequestSchema = z.object({
  /** Background polls from open tabs: skip quietly if a sync is already running. */
  background: z.boolean().optional(),
});

/**
 * Checks Gmail for changes. Open tabs call this every GMAIL_POLL_SECONDS (see
 * components/layout/mail-sync.tsx); the Sync button calls it on demand. After new mail
 * arrives, embeddings and the AI pipeline run in the background via `after()`.
 */
export const POST = apiRoute({ rateLimit: RATE_LIMITS.sync }, async (req, { user }) => {
  const { background } = await parseBody(req, SyncRequestSchema);
  const results = await syncUser(user.id, { ifIdle: background });
  const createdEmailIds = results.flatMap((r) => r.createdEmailIds);
  if (createdEmailIds.length) after(() => runPostSyncJobs(user.id, { emailIds: createdEmailIds }));
  return {
    created: createdEmailIds.length,
    updated: results.reduce((n, r) => n + r.updated + r.removed, 0),
    accounts: results.length,
    errors: results.filter((r) => r.error).map((r) => r.error!),
  };
});
