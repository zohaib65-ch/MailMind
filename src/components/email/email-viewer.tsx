import { ArrowLeft, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AiSummary } from "@/components/ai/ai-summary";
import { ClassificationCard } from "@/components/ai/classification-card";
import { SuggestedActions } from "@/components/ai/suggested-actions";
import { ThreadMemoryCard } from "@/components/ai/thread-memory-card";
import { AiStatusBadge, CategoryBadge, ReplyStatusBadge, UrgencyBadge } from "@/components/common/badges";
import { RelativeTime } from "@/components/common/relative-time";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/lib/utils";
import type { SummaryLength } from "@/schemas/common";
import type { DraftDTO, EmailDetailDTO } from "@/types/email";
import { EmailActions } from "./email-actions";
import { EmailThread } from "./email-thread";
import { ExtractedInfo } from "./extracted-info";
import { ReplyPanel } from "./reply-panel";

/** Email detail: conversation + reply on the left, everything the AI learned on the right. */
export function EmailViewer({
  email,
  draft,
  aiConfigured,
  summaryLength,
}: {
  email: EmailDetailDTO;
  draft: DraftDTO | null;
  aiConfigured: boolean;
  summaryLength: SummaryLength;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/inbox">
          <ArrowLeft /> Inbox
        </Link>
      </Button>

      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{email.subject}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{formatAddress(email.from)}</span>
          <span>→ {email.to.map(formatAddress).join(", ")}</span>
          <RelativeTime iso={email.receivedAt} mode="full" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CategoryBadge category={email.ai.category} />
          <UrgencyBadge urgency={email.ai.urgency} />
          <ReplyStatusBadge status={email.replyStatus} />
          <AiStatusBadge status={email.ai.status} />
        </div>
      </header>

      <EmailActions email={email} aiConfigured={aiConfigured} />

      {email.ai.error && (
        <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {email.ai.error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <EmailThread messages={email.thread.messages} currentId={email.id} />
          <ReplyPanel email={email} initialDraft={draft} aiConfigured={aiConfigured} />
        </div>
        <aside className="space-y-4" aria-label="AI analysis">
          {email.direction === "inbound" && (
            <AiSummary
              emailId={email.id}
              aiConfigured={aiConfigured}
              defaultLength={summaryLength}
              initial={{ short: email.ai.summaryShort, normal: email.ai.summary, detailed: email.ai.summaryDetailed }}
            />
          )}
          <ClassificationCard ai={email.ai} />
          <ExtractedInfo extracted={email.ai.extracted} />
          <SuggestedActions actions={email.ai.actions} />
          <ThreadMemoryCard memory={email.thread.memory} />
        </aside>
      </div>
    </div>
  );
}
