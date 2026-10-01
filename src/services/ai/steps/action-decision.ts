import type { ActionDecision, ClassificationOutput, ExtractedInformation, UrgencyOutput } from "@/schemas/ai";

/*
 * Pipeline step: Action Decision.
 *
 * Deliberately NOT an LLM call. Deciding what MailMind is allowed to do automatically is a
 * policy, and policies should be predictable, testable and easy to audit. The LLM supplies
 * the facts (category, urgency, needsReply); these rules decide the actions.
 *
 * Automatic actions are limited to safe, reversible ones (drafting a reply, starring).
 * Archiving is only ever *suggested*, and sending is never automatic.
 */

export type ActionPolicy = { autoDraftReplies: boolean; autoMarkImportant: boolean };

const NEVER_REPLY = new Set(["spam", "newsletter", "notification", "shopping"]);
const LOW_VALUE = new Set(["newsletter", "shopping", "notification"]);

export function decideActions(input: {
  classification: ClassificationOutput;
  urgency: Pick<UrgencyOutput, "urgency">;
  extracted?: ExtractedInformation | null;
  policy: ActionPolicy;
  alreadyImportant?: boolean;
}): ActionDecision {
  const { classification, urgency, extracted, policy } = input;
  const actions: ActionDecision["actions"] = [];
  const category = classification.category;

  if (category === "spam") {
    actions.push({ type: "suggest_archive", reason: "Looks like spam or a scam", automatic: false });
    return { actions };
  }

  if (classification.needsReply && !NEVER_REPLY.has(category)) {
    actions.push({
      type: "draft_reply",
      reason: "The sender is waiting for a reply",
      automatic: policy.autoDraftReplies,
    });
  }

  const important = urgency.urgency === "high" || category === "important" || category === "interview";
  if (important && !input.alreadyImportant) {
    actions.push({
      type: "mark_important",
      reason: urgency.urgency === "high" ? "High urgency" : `${category === "interview" ? "Interview" : "Important"} email`,
      automatic: policy.autoMarkImportant,
    });
  }

  if (extracted?.tasks.length) {
    actions.push({
      type: "track_tasks",
      reason: `${extracted.tasks.length} task${extracted.tasks.length === 1 ? "" : "s"} for you`,
      automatic: false,
    });
  }

  if (LOW_VALUE.has(category) && urgency.urgency === "low" && !classification.needsReply) {
    actions.push({ type: "suggest_archive", reason: "Low-priority automated email", automatic: false });
  }

  return { actions };
}
