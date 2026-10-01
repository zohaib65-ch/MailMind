"use client";

import { Bot, MessageSquareText, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/common/relative-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ConversationDetailDTO, ConversationSummaryDTO } from "@/types/agent";
import { ApprovalCard } from "./approval-card";
import { ChatComposer } from "./chat-composer";
import { ChatMessage } from "./chat-message";
import { EXAMPLE_PROMPTS } from "./quick-prompts";

/** A fresh nonce per click, so "New conversation" always starts an empty chat. */
function newChatUrl() {
  return `/assistant?new=${Date.now()}`;
}

function ConversationList({ conversations, activeId }: { conversations: ConversationSummaryDTO[]; activeId: string | null }) {
  const router = useRouter();
  async function remove(id: string) {
    await api(`/api/assistant/conversations/${id}`, { method: "DELETE" }).catch(() => toast.error("Could not delete"));
    if (id === activeId) router.push(newChatUrl());
    router.refresh();
  }
  return (
    <nav className="space-y-1" aria-label="Conversations">
      <Button variant="outline" size="sm" className="mb-2 w-full justify-start" onClick={() => router.push(newChatUrl())}>
        <Plus /> New conversation
      </Button>
      {conversations.length === 0 && <p className="px-2 text-xs text-muted-foreground">No conversations yet.</p>}
      {conversations.map((c) => (
        <div
          key={c.id}
          className={cn("group flex items-center gap-1 rounded-md hover:bg-muted", c.id === activeId && "bg-muted font-medium")}
        >
          <Link href={`/assistant?c=${c.id}`} className="min-w-0 flex-1 px-2 py-1.5">
            <p className="truncate text-sm">{c.title}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {c.hasPendingApproval && <span className="size-1.5 rounded-full bg-amber-500" aria-label="Waiting for approval" />}
              <RelativeTime iso={c.updatedAt} mode="relative" />
            </p>
          </Link>
          <Button
            variant="ghost"
            size="icon-xs"
            className="mr-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Delete ${c.title}`}
            onClick={() => remove(c.id)}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </nav>
  );
}

export function AssistantView({
  conversations: initialConversations,
  conversation,
  initialPrompt,
  aiConfigured,
}: {
  conversations: ConversationSummaryDTO[];
  conversation: ConversationDetailDTO | null;
  initialPrompt?: string;
  aiConfigured: boolean;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const onConversation = useCallback((id: string) => {
    // Keep the URL shareable without remounting the live chat (the `new` nonce stays, so
    // a later router.refresh() renders with the same key).
    const params = new URLSearchParams(window.location.search);
    params.set("c", id);
    params.delete("prompt");
    window.history.replaceState(null, "", `/assistant?${params.toString()}`);
  }, []);
  const chat = useAgentChat(conversation, onConversation);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages, chat.approval]);

  // Refresh the sidebar list after each run finishes.
  useEffect(() => {
    if (chat.running) return;
    void api<{ conversations: ConversationSummaryDTO[] }>("/api/assistant/conversations")
      .then((r) => setConversations(r.conversations))
      .catch(() => undefined);
  }, [chat.running, chat.conversationId]);

  const empty = chat.messages.length === 0;
  return (
    <div className="mx-auto grid h-[calc(100vh-7.5rem)] max-w-6xl gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden min-h-0 overflow-y-auto pr-2 lg:block">
        <ConversationList conversations={conversations} activeId={chat.conversationId} />
      </aside>

      <section className="flex min-h-0 flex-col gap-4">
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 pb-4 pr-3">
            {empty && (
              <div className="flex flex-col items-center gap-4 pt-10 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold">What can I do for your inbox?</h1>
                  <p className="max-w-md text-sm text-muted-foreground">
                    I use controlled tools to search, read and draft — you&apos;ll see every step. I never send an email without your approval.
                  </p>
                </div>
                <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={!aiConfigured || chat.running}
                      onClick={() => chat.send(p)}
                      className="flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50"
                    >
                      <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" /> {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chat.messages.map((m, i) => (
              <ChatMessage
                key={m.id}
                message={m}
                live={chat.running && i === chat.messages.length - 1 && m.role === "assistant"}
                pendingDraftId={chat.approval?.draftId}
              />
            ))}
            {chat.approval && <ApprovalCard approval={chat.approval} busy={chat.running} onDecision={chat.respond} />}
            {chat.error && (
              <Alert variant="destructive">
                <AlertDescription>{chat.error}</AlertDescription>
              </Alert>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {!aiConfigured && (
          <Alert>
            <AlertDescription>Set GEMINI_API_KEY to use the assistant.</AlertDescription>
          </Alert>
        )}
        <ChatComposer
          key={initialPrompt}
          initialValue={initialPrompt}
          running={chat.running}
          disabled={!aiConfigured || Boolean(chat.approval)}
          placeholder={chat.approval ? "Approve or reject the email above to continue…" : undefined}
          onSend={chat.send}
          onStop={chat.stop}
        />
      </section>
    </div>
  );
}
