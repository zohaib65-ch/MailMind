import "server-only";
import { z } from "zod";
import { toObjectId } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models";
import { defineAgentTool, type AgentToolContext } from "./define-tool";

const MAX_MEMORIES = 50;

/**
 * Long-term memory across conversations. Saved notes are added to the agent's system
 * prompt and to the reply drafter's context in every future conversation.
 */
export function memoryTools(ctx: AgentToolContext) {
  const rememberFact = defineAgentTool(ctx, {
    name: "rememberFact",
    icon: "🧠",
    description:
      "Save a durable fact or preference the user wants you to remember in future conversations (e.g. 'I sign emails as Sam', 'Ali is our most important client'). Only use when the user asks you to remember something.",
    schema: z.object({ fact: z.string().min(3).max(300) }),
    label: () => "Saving to memory…",
    run: async ({ fact }) => {
      await User.updateOne(
        { _id: toObjectId(ctx.userId) },
        { $push: { memories: { $each: [{ text: fact.trim(), createdAt: new Date() }], $slice: -MAX_MEMORIES } } },
      );
      return { result: { saved: true }, summary: "Saved to memory" };
    },
  });
  return [rememberFact];
}
