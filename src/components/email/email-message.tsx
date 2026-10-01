import { RelativeTime } from "@/components/common/relative-time";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, displayName, formatAddress, initials } from "@/lib/utils";
import type { ThreadMessageDTO } from "@/types/email";

/**
 * One message in a conversation. Bodies are shown as plain text (whitespace preserved),
 * never as HTML — email content is untrusted.
 */
export function EmailMessage({ message, highlighted = false, collapsed = false }: { message: ThreadMessageDTO; highlighted?: boolean; collapsed?: boolean }) {
  const fromUser = message.direction === "outbound";
  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-4",
        highlighted && "border-primary/30 ring-1 ring-primary/15",
        fromUser && "bg-muted/30",
      )}
    >
      <header className="flex items-start gap-3">
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{initials(displayName(message.from))}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-sm font-medium">
              {displayName(message.from)}
              {fromUser && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
            </p>
            <RelativeTime iso={message.receivedAt} mode="full" className="ml-auto shrink-0 text-xs text-muted-foreground" />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            to {message.to.map(formatAddress).join(", ")}
            {message.cc.length > 0 && ` · cc ${message.cc.map(formatAddress).join(", ")}`}
          </p>
        </div>
      </header>
      <div className={cn("mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed", collapsed && "line-clamp-3 text-muted-foreground")}>
        {message.bodyText || <span className="italic text-muted-foreground">(empty message)</span>}
      </div>
    </article>
  );
}
