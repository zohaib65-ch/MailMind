import { apiRoute, parseBody, sseResponse } from "@/lib/utils/http";
import { RATE_LIMITS } from "@/lib/utils/rate-limit";
import { ProcessEmailSchema } from "@/schemas/api";
import type { PipelineStepEvent } from "@/services/ai/pipeline";
import { processEmail } from "@/services/ai/processing.service";
import { indexPendingEmails } from "@/services/embeddings/indexer";

export const maxDuration = 120;

/**
 * Runs the AI pipeline on one email and streams each step as it happens (SSE):
 *   { type: "step", step: "classify", status: "done", detail: "Interview · 95% confident" }
 */
export const POST = apiRoute<{ id: string }>({ rateLimit: RATE_LIMITS.ai }, async (req, { user, params }) => {
  const { force } = await parseBody(req, ProcessEmailSchema);
  async function* events() {
    const queue: PipelineStepEvent[] = [];
    let wake: (() => void) | undefined;
    let finished = false;
    let failure: unknown;
    const run = processEmail(user.id, params.id, {
      force,
      onStep: (e) => {
        queue.push(e);
        wake?.();
      },
    })
      .catch((err) => {
        failure = err;
      })
      .finally(() => {
        finished = true;
        wake?.();
      });
    while (!finished || queue.length) {
      if (!queue.length) await new Promise<void>((resolve) => (wake = resolve));
      while (queue.length) yield { type: "step", ...queue.shift()! };
    }
    await run;
    if (failure) throw failure;
    await indexPendingEmails(user.id).catch(() => undefined);
    yield { type: "done" };
  }
  return sseResponse(events());
});
