import type { EmailAddress } from "@/schemas/common";
import type { DraftDTO } from "./email";

/**
 * A safe, high-level step shown in the "AI Activity" panel, e.g.
 *   🔎 Searching emails…  →  ✓ Found 8 emails
 * These describe tool calls and their results only — never the model's hidden reasoning.
 */
export type ActivityStep = {
  id: string;
  tool?: string;
  icon: string;
  label: string;
  status: "running" | "done" | "error" | "awaiting_approval";
  detail?: string;
  startedAt: string;
  finishedAt?: string;
};

/** What the user sees (and can edit) before the agent is allowed to send an email. */
export type SendApprovalRequest = {
  kind: "send_email";
  toolCallId: string;
  draftId: string;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  body: string;
  requestedAt: string;
};

export type ApprovalDecision =
  | { action: "approve"; draftId: string }
  | { action: "reject"; draftId: string; reason?: string };

/** Server-sent events emitted by POST /api/assistant/chat and /api/assistant/resume. */
export type AgentStreamEvent =
  | { type: "conversation"; conversationId: string; title: string }
  | { type: "activity"; step: ActivityStep }
  | { type: "token"; text: string }
  | { type: "draft"; draft: DraftDTO }
  | { type: "approval_required"; approval: SendApprovalRequest }
  | { type: "done"; messageId: string; content: string }
  | { type: "error"; message: string; code?: string };

export type ConversationSummaryDTO = {
  id: string;
  title: string;
  updatedAt: string;
  hasPendingApproval: boolean;
};

export type ConversationMessageDTO = {
  id: string;
  role: "user" | "assistant";
  content: string;
  activity: ActivityStep[];
  drafts: DraftDTO[];
  createdAt: string;
};

export type ConversationDetailDTO = {
  id: string;
  title: string;
  messages: ConversationMessageDTO[];
  pendingApproval: SendApprovalRequest | null;
};
