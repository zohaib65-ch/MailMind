import {
  Bell,
  Briefcase,
  CircleHelp,
  Flame,
  Handshake,
  LifeBuoy,
  Newspaper,
  OctagonAlert,
  ShieldAlert,
  ShoppingBag,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type AiStatus, type EmailCategory, type ReplyStatus, type Urgency } from "@/schemas/common";

const CATEGORY_STYLES: Record<EmailCategory, { icon: LucideIcon; className: string }> = {
  work: { icon: Briefcase, className: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  personal: { icon: User, className: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  finance: { icon: Wallet, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  shopping: { icon: ShoppingBag, className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  interview: { icon: Handshake, className: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300" },
  newsletter: { icon: Newspaper, className: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  notification: { icon: Bell, className: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
  support: { icon: LifeBuoy, className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" },
  important: { icon: OctagonAlert, className: "bg-red-500/10 text-red-700 dark:text-red-300" },
  spam: { icon: ShieldAlert, className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400" },
  other: { icon: CircleHelp, className: "bg-muted text-muted-foreground" },
};

export function CategoryBadge({ category, className }: { category?: EmailCategory | null; className?: string }) {
  if (!category) return null;
  const { icon: Icon, className: tone } = CATEGORY_STYLES[category];
  return (
    <Badge variant="secondary" className={cn("gap-1 border-0", tone, className)}>
      <Icon data-icon="inline-start" />
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}

const URGENCY_STYLES: Record<Urgency, string> = {
  high: "bg-red-500/10 text-red-700 dark:text-red-300",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "bg-muted text-muted-foreground",
};

export function UrgencyBadge({ urgency, className }: { urgency?: Urgency | null; className?: string }) {
  if (!urgency) return null;
  return (
    <Badge variant="secondary" className={cn("gap-1 border-0 capitalize", URGENCY_STYLES[urgency], className)}>
      {urgency === "high" && <Flame data-icon="inline-start" />}
      {urgency}
    </Badge>
  );
}

const REPLY_LABELS: Partial<Record<ReplyStatus, { label: string; className: string }>> = {
  needs_reply: { label: "Needs reply", className: "border-orange-500/40 text-orange-700 dark:text-orange-300" },
  drafted: { label: "Draft ready", className: "border-primary/40 text-primary" },
  replied: { label: "Replied", className: "text-muted-foreground" },
};

export function ReplyStatusBadge({ status }: { status: ReplyStatus }) {
  const info = REPLY_LABELS[status];
  if (!info) return null;
  return (
    <Badge variant="outline" className={info.className}>
      {info.label}
    </Badge>
  );
}

export function AiStatusBadge({ status }: { status: AiStatus }) {
  if (status === "processed") return null;
  const labels: Record<AiStatus, string> = {
    pending: "Not analysed yet",
    processing: "Analysing…",
    processed: "",
    failed: "AI failed",
    skipped: "Skipped",
  };
  return (
    <Badge variant="outline" className={cn("text-muted-foreground", status === "failed" && "border-destructive/40 text-destructive")}>
      {labels[status]}
    </Badge>
  );
}
