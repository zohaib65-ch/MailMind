import "server-only";
import { contactTools } from "./contact-tools";
import type { AgentToolContext } from "./define-tool";
import { draftTools } from "./draft-tools";
import { emailTools } from "./email-tools";
import { memoryTools } from "./memory-tools";

export type { AgentToolContext } from "./define-tool";

/**
 * The complete, controlled set of things the agent can do. There is no generic "run a
 * query" or "call the Gmail API" tool: anything not listed here is impossible for the model.
 * Tool order is fixed so the prompt prefix (and its cache) stays stable between requests.
 */
export function buildAgentTools(ctx: AgentToolContext) {
  return [...emailTools(ctx), ...contactTools(ctx), ...draftTools(ctx), ...memoryTools(ctx)];
}

/** Tools that need the user's explicit approval before they take effect. */
export const APPROVAL_REQUIRED_TOOLS = ["sendEmail"] as const;
