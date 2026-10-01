import type { Metadata } from "next";
import { AssistantView } from "@/components/ai/assistant-view";
import { isObjectId } from "@/lib/db/mongoose";
import { isAiConfigured } from "@/lib/utils/env";
import { NotFoundError } from "@/lib/utils/errors";
import { getConversationDetail, listConversations } from "@/services/agent/conversation.service";
import { requireUser } from "@/services/auth/dal";

export const metadata: Metadata = { title: "AI Assistant" };

export default async function AssistantPage({ searchParams }: PageProps<"/assistant">) {
  const user = await requireUser();
  const params = await searchParams;
  const conversationId = typeof params.c === "string" && isObjectId(params.c) ? params.c : null;
  const prompt = typeof params.prompt === "string" ? params.prompt.slice(0, 500) : undefined;
  // `new` is a per-chat nonce: it keeps the chat mounted while a new conversation gets its
  // id (the URL gains ?c=… without a reload), and changes when you start another chat.
  const nonce = typeof params.new === "string" ? params.new.slice(0, 40) : undefined;

  const [conversations, conversation] = await Promise.all([
    listConversations(user.id),
    conversationId
      ? getConversationDetail(user.id, conversationId).catch((err) => {
          if (err instanceof NotFoundError) return null;
          throw err;
        })
      : Promise.resolve(null),
  ]);

  return (
    <AssistantView
      // Remount when switching conversations so the chat state starts fresh.
      key={nonce ?? conversation?.id ?? "new"}
      conversations={conversations}
      conversation={conversation}
      initialPrompt={conversation ? undefined : prompt}
      aiConfigured={isAiConfigured()}
    />
  );
}
