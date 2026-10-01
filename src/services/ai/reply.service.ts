import "server-only";
import { ValidationError } from "@/lib/utils/errors";
import type { DraftSource } from "@/schemas/common";
import { createDraft } from "@/services/email/draft.service";
import type { DraftDTO } from "@/types/email";
import { trackAiTask } from "./ai-task.service";
import { buildReplyContext, loadEmailContext, type EmailContext } from "./context";
import { draftReply } from "./steps/reply-drafter";

/**
 * Generates an AI reply for an email and saves it as a draft awaiting review.
 * Shared by the pipeline, the "Generate AI Reply" button and the agent's createDraft tool.
 */
export async function generateReplyDraft(options: {
  userId: string;
  emailId: string;
  source: Exclude<DraftSource, "user">;
  instructions?: string;
  conversationId?: string;
  pipelineRunId?: string;
  context?: EmailContext;
}): Promise<DraftDTO> {
  const ctx = options.context ?? (await loadEmailContext(options.userId, options.emailId));
  if (ctx.email.direction === "outbound") throw new ValidationError("You can only reply to emails you received");

  const reply = await trackAiTask(
    {
      userId: options.userId,
      type: "draft_reply",
      emailId: options.emailId,
      conversationId: options.conversationId,
      pipelineRunId: options.pipelineRunId,
      input: { instructions: options.instructions ?? null, source: options.source },
    },
    async () => {
      const result = await draftReply(buildReplyContext(ctx, options.instructions));
      return {
        result,
        output: { subject: result.data.subject, notes: result.data.notes },
        usage: result.usage,
        model: result.model,
      };
    },
  );

  return createDraft({
    userId: options.userId,
    emailId: options.emailId,
    subject: reply.data.subject,
    body: reply.data.body,
    notes: reply.data.notes,
    source: options.source,
    model: reply.model,
    conversationId: options.conversationId,
  });
}
