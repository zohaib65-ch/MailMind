import { RelativeTime } from "@/components/common/relative-time";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, displayName, formatAddress, initials } from "@/lib/utils";
import { splitQuotedReply, unquote } from "@/lib/utils/quoted-text";
import type { ThreadMessageDTO } from "@/types/email";

/**
 * One message in a conversation. Bodies are shown as plain text (whitespace preserved),
 * never as HTML — email content is untrusted. Quoted earlier messages ("On … wrote:") are
 * folded behind a "•••" toggle, since the thread already shows them.
 */
export function EmailMessage({ message, highlighted = false, collapsed = false }: { message: ThreadMessageDTO; highlighted?: boolean; collapsed?: boolean }) {
  const fromUser = message.direction === "outbound";
  const { body, quoted } = splitQuotedReply(message.bodyText);
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
        {body || <span className="italic text-muted-foreground">(empty message)</span>}
      </div>
      {quoted && !collapsed && (
        <details className="mt-2">
          <summary
            title="Show quoted text"
            className="inline-flex cursor-pointer list-none rounded-md bg-muted px-2 text-xs leading-5 tracking-widest text-muted-foreground hover:bg-muted/70 [&::-webkit-details-marker]:hidden"
          >
            •••<span className="sr-only">Show quoted text</span>
          </summary>
          <div className="mt-2 whitespace-pre-wrap break-words border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground">
            {unquote(quoted)}
          </div>
        </details>
      )}
    </article>
  );
}
