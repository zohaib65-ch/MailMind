"use client";

import { Bot, LoaderCircle } from "lucide-react";
import { Markdown } from "@/components/common/markdown";
import { cn } from "@/lib/utils";
import type { ConversationMessageDTO } from "@/types/agent";
import { AgentActivity } from "./agent-activity";
import { AiDraft } from "./ai-draft";

export function ChatMessage({
  message,
  live = false,
  pendingDraftId,
}: {
  message: ConversationMessageDTO;
  live?: boolean;
  /** The draft currently shown in the approval card; not repeated here. */
  pendingDraftId?: string;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }
  const thinking = live && !message.content && !message.activity.some((s) => s.status === "running");
  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bot className="size-4 text-primary" />
      </div>
      <div className={cn("min-w-0 flex-1 space-y-3", live && "pb-2")}>
        <AgentActivity steps={message.activity} live={live} />
        {thinking && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Working on it…
          </p>
        )}
        {message.content && <Markdown>{message.content}</Markdown>}
        {message.drafts.map((draft) =>
          draft.id === pendingDraftId ? (
            <p key={draft.id} className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
              Draft “{draft.subject}” is waiting for your approval below.
            </p>
          ) : (
            <AiDraft key={draft.id} draft={draft} compact title="Draft reply" />
          ),
        )}
      </div>
    </div>
  );
}
