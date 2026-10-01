import "server-only";
import { createAgent, modelCallLimitMiddleware, toolCallLimitMiddleware } from "langchain";
import { getChatModel } from "@/lib/langchain/model";
import { getCheckpointer } from "./checkpointer";
import { buildAgentSystemPrompt } from "./prompt";
import { buildAgentTools, type AgentToolContext } from "./tools";

/**
 * The MailMind agent: a LangChain v1 `createAgent` (a LangGraph ReAct loop) with:
 *  - controlled, user-scoped tools (services/agent/tools)
 *  - a MongoDB checkpointer for conversation memory and pausing for approval
 *  - guardrail middleware capping model calls and tool calls per run, so a confused
 *    model can't loop forever or archive half the inbox
 *
 * `version: "v2"` runs each tool call as its own graph task, which is what allows
 * `interrupt()` inside an individual tool (the sendEmail approval step).
 */
export async function createMailAgent(ctx: AgentToolContext & { memories: string[] }) {
  return createAgent({
    name: "mailmind_agent",
    model: getChatModel("agent"),
    tools: buildAgentTools(ctx),
    systemPrompt: buildAgentSystemPrompt({ name: ctx.userName, email: ctx.userEmail, memories: ctx.memories }),
    checkpointer: await getCheckpointer(),
    version: "v2",
    middleware: [
      modelCallLimitMiddleware({ runLimit: 15, exitBehavior: "end" }),
      toolCallLimitMiddleware({ runLimit: 30, exitBehavior: "continue" }),
      toolCallLimitMiddleware({ toolName: "archiveEmail", runLimit: 10, exitBehavior: "continue" }),
      toolCallLimitMiddleware({ toolName: "sendEmail", runLimit: 3, exitBehavior: "continue" }),
    ],
  });
}
