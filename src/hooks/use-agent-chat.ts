"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError, streamEvents } from "@/lib/api-client";
import type {
  ActivityStep,
  AgentStreamEvent,
  ConversationDetailDTO,
  ConversationMessageDTO,
  SendApprovalRequest,
} from "@/types/agent";
import type { DraftDTO } from "@/types/email";

type Edits = { to?: { name?: string; email: string }[]; subject?: string; body?: string };

/**
 * State machine for the assistant chat. Talks to the SSE endpoints and keeps the live
 * assistant message (streamed text + tool activity + drafts) up to date as events arrive.
 */
export function useAgentChat(initial: ConversationDetailDTO | null, onConversation?: (id: string) => void) {
  const [conversationId, setConversationId] = useState<string | null>(initial?.id ?? null);
  const [messages, setMessages] = useState<ConversationMessageDTO[]>(initial?.messages ?? []);
  const [approval, setApproval] = useState<SendApprovalRequest | null>(initial?.pendingApproval ?? null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateLive = useCallback((fn: (m: ConversationMessageDTO) => ConversationMessageDTO) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant" || !last.id.startsWith("live-")) return prev;
      return [...prev.slice(0, -1), fn(last)];
    });
  }, []);

  const handleEvent = useCallback(
    (event: AgentStreamEvent) => {
      switch (event.type) {
        case "conversation":
          setConversationId(event.conversationId);
          onConversation?.(event.conversationId);
          break;
        case "activity":
          updateLive((m) => {
            const activity: ActivityStep[] = m.activity.some((s) => s.id === event.step.id)
              ? m.activity.map((s) => (s.id === event.step.id ? event.step : s))
              : [...m.activity, event.step];
            return { ...m, activity };
          });
          break;
        case "token":
          updateLive((m) => ({ ...m, content: m.content + event.text }));
          break;
        case "draft":
          updateLive((m) => {
            const drafts: DraftDTO[] = m.drafts.some((d) => d.id === event.draft.id)
              ? m.drafts.map((d) => (d.id === event.draft.id ? event.draft : d))
              : [...m.drafts, event.draft];
            return { ...m, drafts };
          });
          break;
        case "approval_required":
          setApproval(event.approval);
          break;
        case "done":
          updateLive((m) => ({ ...m, id: event.messageId, content: event.content }));
          break;
        case "error":
          setError(event.message);
          break;
      }
    },
    [onConversation, updateLive],
  );

  const run = useCallback(
    async (path: string, body: unknown, userText: string) => {
      setError(null);
      setRunning(true);
      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { id: `local-${now}`, role: "user", content: userText, activity: [], drafts: [], createdAt: now },
        { id: `live-${now}`, role: "assistant", content: "", activity: [], drafts: [], createdAt: now },
      ]);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await streamEvents<AgentStreamEvent>(path, body, handleEvent, controller.signal);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(err instanceof ApiError ? err.message : "Something went wrong");
      } finally {
        // Drop the placeholder if nothing came back (e.g. the request was rejected).
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return last?.id.startsWith("live-") && !last.content && !last.activity.length && !last.drafts.length
            ? prev.slice(0, -1)
            : prev;
        });
        setRunning(false);
        abortRef.current = null;
      }
    },
    [handleEvent],
  );

  const send = useCallback(
    (message: string) => run("/api/assistant/chat", { message, conversationId: conversationId ?? undefined }, message),
    [conversationId, run],
  );

  const respond = useCallback(
    async (decision: "approve" | "reject", edits?: Edits, reason?: string) => {
      if (!conversationId || !approval) return;
      setApproval(null);
      await run(
        "/api/assistant/resume",
        { conversationId, decision, edits, reason },
        decision === "approve" ? "✅ Approved sending the email." : `❌ Don't send it.${reason ? ` ${reason}` : ""}`,
      );
    },
    [approval, conversationId, run],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { conversationId, messages, approval, running, error, send, respond, stop };
}
