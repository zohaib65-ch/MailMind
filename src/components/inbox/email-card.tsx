import { Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { AiStatusBadge, CategoryBadge, ReplyStatusBadge, UrgencyBadge } from "@/components/common/badges";
import { RelativeTime } from "@/components/common/relative-time";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, displayName, initials } from "@/lib/utils";
import type { EmailListItemDTO } from "@/types/email";

/** One row of the inbox: sender, subject, AI summary, category, urgency, status and date. */
export function EmailCard({ email, excerpt }: { email: EmailListItemDTO; excerpt?: string }) {
  const unread = !email.isRead;
  const summary = excerpt ?? email.ai.summary;
  return (
    <Link
      href={`/emails/${email.id}`}
      className={cn(
        "group flex gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        unread && "border-primary/25",
      )}
    >
      <div className="relative">
        <Avatar className="size-9">
          <AvatarFallback className="text-xs">{initials(displayName(email.from))}</AvatarFallback>
        </Avatar>
        {unread && <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-card" aria-label="Unread" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline gap-2">
          <p className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
            {email.direction === "outbound" ? `To: ${displayName(email.from)}` : displayName(email.from)}
          </p>
          {email.isImportant && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Important" />}
          <RelativeTime iso={email.receivedAt} className="ml-auto shrink-0 text-xs text-muted-foreground" />
        </div>
        <p className={cn("truncate text-sm", unread ? "text-foreground" : "text-foreground/80")}>{email.subject}</p>
        {summary ? (
          <p className="flex gap-1.5 text-sm text-muted-foreground">
            {!excerpt && <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary/70" aria-label="AI summary" />}
            <span className="line-clamp-2 whitespace-pre-line">{summary}</span>
          </p>
        ) : (
          <p className="line-clamp-1 text-sm text-muted-foreground">{email.snippet}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <CategoryBadge category={email.ai.category} />
          <UrgencyBadge urgency={email.ai.urgency} />
          <ReplyStatusBadge status={email.replyStatus} />
          <AiStatusBadge status={email.ai.status} />
        </div>
      </div>
    </Link>
  );
}
