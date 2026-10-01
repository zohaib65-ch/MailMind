import "server-only";
import { interrupt } from "@langchain/langgraph";
import { z } from "zod";
import { formatAddressHeader } from "@/lib/utils/email-text";
import { ValidationError } from "@/lib/utils/errors";
import { generateReplyDraft } from "@/services/ai/reply.service";
import { getDraft, sendApprovedDraft } from "@/services/email/draft.service";
import type { ApprovalDecision, SendApprovalRequest } from "@/types/agent";
import { defineAgentTool, type AgentToolContext, type ToolOutcome } from "./define-tool";

export function draftTools(ctx: AgentToolContext) {
  const createDraft = defineAgentTool(ctx, {
    name: "createDraft",
    icon: "✍️",
    description:
      "Write a reply draft to an email, using MailMind's memory of the conversation. The draft is saved for the user to review — it is NOT sent. Pass the user's intent as instructions (e.g. 'accept and propose Tuesday 2pm', 'politely decline').",
    schema: z.object({
      emailId: z.string().describe("The email to reply to."),
      instructions: z.string().max(1_000).optional().describe("What the reply should say, in the user's words."),
    }),
    label: () => "Drafting a reply…",
    run: async ({ emailId, instructions }) => {
      const draft = await generateReplyDraft({
        userId: ctx.userId,
        emailId,
        source: "agent",
        instructions,
        conversationId: ctx.conversationId,
      });
      return {
        result: {
          draftId: draft.id,
          to: formatAddressHeader(draft.to),
          subject: draft.subject,
          body: draft.body,
          notes: draft.notes,
          status: "saved for review (not sent)",
        },
        summary: `Draft ready: “${draft.subject}”`,
        events: [{ type: "draft", draft }],
      };
    },
  });

  /*
   * Human-in-the-loop, enforced twice:
   *  1. interrupt() pauses the agent run here. The run is checkpointed, the UI shows the
   *     draft, and nothing continues until the user answers.
   *  2. Even after resuming, sendApprovedDraft() refuses unless the draft was marked
   *     "approved" by the user's own request (POST /api/assistant/resume). The model has no
   *     way to set that status.
   */
  const sendEmail = defineAgentTool(ctx, {
    name: "sendEmail",
    icon: "📨",
    description:
      "Send an existing draft. This pauses and shows the draft to the user, who can edit, approve or reject it; the email is only sent if they approve. Only call this when the user has explicitly asked you to send, and call it on its own (not in parallel with other tools).",
    schema: z.object({ draftId: z.string().describe("The draftId returned by createDraft.") }),
    label: () => "Asking for approval to send…",
    run: async ({ draftId }, runtime): Promise<ToolOutcome<Record<string, unknown>>> => {
      const draft = await getDraft(ctx.userId, draftId);
      if (draft.status === "sent") return { result: { sent: true, alreadySent: true }, summary: "Already sent" };
      if (!["pending_review", "approved", "failed"].includes(draft.status)) {
        throw new ValidationError(`This draft is ${draft.status.replace("_", " ")} and can't be sent`);
      }

      const request: SendApprovalRequest = {
        kind: "send_email",
        toolCallId: runtime?.toolCallId ?? "",
        draftId: draft.id,
        to: draft.to,
        cc: draft.cc,
        subject: draft.subject,
        body: draft.body,
        requestedAt: new Date().toISOString(),
      };
      // First run: throws, pausing the graph. On resume: returns the user's decision.
      const decision = interrupt<SendApprovalRequest, ApprovalDecision>(request);

      if (decision?.action !== "approve" || decision.draftId !== draft.id) {
        const reason = decision?.action === "reject" && decision.reason ? ` Reason: ${decision.reason}` : "";
        return {
          result: { sent: false, userDeclined: true, message: `The user chose not to send this email.${reason}` },
          summary: "You chose not to send",
        };
      }

      const sent = await sendApprovedDraft(ctx.userId, draft.id);
      return {
        result: { sent: true, to: formatAddressHeader(sent.to), subject: sent.subject },
        summary: `Sent to ${sent.to.map((t) => t.name ?? t.email).join(", ")}`,
        events: [{ type: "draft", draft: sent }],
      };
    },
  });

  return [createDraft, sendEmail];
}
