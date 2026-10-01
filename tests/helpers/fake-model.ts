import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, type BaseMessage, ToolMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import { RunnableLambda } from "@langchain/core/runnables";

/**
 * A scripted chat model for tests: no network, fully deterministic.
 *
 *  - As an agent model, each call returns the next scripted AIMessage. A script step can be
 *    a function of the conversation so far (e.g. to use an id from a previous tool result).
 *  - As a structured-output model, `withStructuredOutput(schema, { name })` answers with
 *    whatever `structured[name]` returns.
 */
export type ScriptStep = AIMessage | ((messages: BaseMessage[]) => AIMessage);

export class ScriptedChatModel extends BaseChatModel {
  calls = 0;

  constructor(
    private readonly script: ScriptStep[] = [],
    private readonly structured: Record<string, (messages: BaseMessage[]) => unknown> = {},
  ) {
    super({});
  }

  _llmType() {
    return "scripted";
  }

  bindTools() {
    return this as never;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withStructuredOutput(_schema: unknown, config?: { name?: string }): any {
    const name = config?.name ?? "";
    return new RunnableLambda({
      func: async (messages: BaseMessage[]) => {
        const responder = this.structured[name] ?? this.structured[name.replace(/_(short|normal|detailed)$/, "")];
        if (!responder) throw new Error(`No scripted structured output for "${name}"`);
        const parsed = responder(messages);
        return {
          raw: new AIMessage({
            content: JSON.stringify(parsed),
            response_metadata: { stop_reason: "end_turn", model: "scripted-model" },
            usage_metadata: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
          }),
          parsed,
        };
      },
    });
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const step = this.script[this.calls] ?? new AIMessage("Done.");
    this.calls += 1;
    const message = typeof step === "function" ? step(messages) : step;
    if (!message.id) message.id = `scripted-${this.calls}`;
    return { generations: [{ message, text: typeof message.content === "string" ? message.content : "" }] };
  }
}

/** Parses the JSON content of the most recent tool result with the given name. */
export function lastToolResult<T = Record<string, unknown>>(messages: BaseMessage[], toolName: string): T {
  const msg = [...messages].reverse().find((m) => ToolMessage.isInstance(m) && m.name === toolName);
  if (!msg) throw new Error(`No ${toolName} result in history`);
  return JSON.parse(String(msg.content)) as T;
}

export function toolCall(name: string, args: Record<string, unknown>, id = `call_${name}_${Math.random().toString(36).slice(2, 8)}`) {
  return new AIMessage({ content: "", tool_calls: [{ id, name, args, type: "tool_call" }] });
}
