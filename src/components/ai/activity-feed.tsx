import {
  Bot,
  BrainCircuit,
  CircleCheck,
  CircleX,
  Clock,
  ListChecks,
  LoaderCircle,
  PenLine,
  Search,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/common/relative-time";
import { cn } from "@/lib/utils";
import type { ActivityItemDTO } from "@/types/email";

const TASK_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  pipeline: { label: "AI pipeline", icon: Sparkles },
  classify: { label: "Classifier", icon: ListChecks },
  extract: { label: "Information extractor", icon: Search },
  summarize: { label: "Summarizer", icon: Sparkles },
  urgency: { label: "Urgency detector", icon: Clock },
  action_decision: { label: "Action decision", icon: ListChecks },
  draft_reply: { label: "Reply drafter", icon: PenLine },
  memory_update: { label: "Conversation memory", icon: BrainCircuit },
  agent_run: { label: "Assistant", icon: Bot },
  rag_answer: { label: "Ask your inbox", icon: Search },
  embed: { label: "Embeddings", icon: BrainCircuit },
};

const TOOL_LABELS: Record<string, string> = {
  searchEmails: "Search emails",
  semanticSearch: "Semantic search",
  getEmail: "Read email",
  getConversation: "Read conversation",
  searchContacts: "Look up contacts",
  createDraft: "Create draft",
  sendEmail: "Send email",
  archiveEmail: "Archive email",
  markAsImportant: "Mark as important",
  rememberFact: "Save to memory",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "running") return <LoaderCircle className="size-3.5 animate-spin text-primary" aria-label="Running" />;
  if (status === "failed") return <CircleX className="size-3.5 text-destructive" aria-label="Failed" />;
  if (status === "awaiting_approval") return <Clock className="size-3.5 text-amber-500" aria-label="Awaiting approval" />;
  if (status === "skipped" || status === "rejected") return <CircleX className="size-3.5 text-muted-foreground" aria-label={status} />;
  return <CircleCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-label="Succeeded" />;
}

/** The audit trail: AI steps and tool calls. Shows high-level actions and results only. */
export function ActivityFeed({ items, detailed = false }: { items: ActivityItemDTO[]; detailed?: boolean }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No AI activity yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const meta = item.kind === "ai_task" ? TASK_LABELS[item.name] : undefined;
        const Icon = meta?.icon ?? Wrench;
        const href = item.emailId ? `/emails/${item.emailId}` : item.conversationId ? `/assistant?c=${item.conversationId}` : undefined;
        const title = meta?.label ?? TOOL_LABELS[item.name] ?? item.name;
        return (
          <li key={`${item.kind}-${item.id}`} className="flex gap-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className="size-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm">
                <StatusIcon status={item.status} />
                {href ? (
                  <Link href={href} className="truncate font-medium hover:underline">
                    {title}
                  </Link>
                ) : (
                  <span className="truncate font-medium">{title}</span>
                )}
                {item.kind === "tool" && (
                  <span className="shrink-0 whitespace-nowrap rounded bg-muted px-1 text-[11px] text-muted-foreground">
                    {item.source === "pipeline" ? "pipeline" : "agent"}
                  </span>
                )}
                <RelativeTime iso={item.startedAt} mode="relative" className="ml-auto shrink-0 text-xs text-muted-foreground" />
              </div>
              <p className={cn("truncate text-sm text-muted-foreground", item.error && "text-destructive")}>
                {item.error ?? item.summary ?? "—"}
              </p>
              {detailed && (item.inputTokens || item.latencyMs) && (
                <p className="font-mono text-[11px] text-muted-foreground">
                  {item.model && `${item.model} · `}
                  {item.inputTokens ? `${item.inputTokens.toLocaleString()} in / ${(item.outputTokens ?? 0).toLocaleString()} out tokens · ` : ""}
                  {item.latencyMs !== undefined ? `${(item.latencyMs / 1000).toFixed(1)}s` : ""}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
