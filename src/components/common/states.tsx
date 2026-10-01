import { CircleX, LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center", className)}>
      <div className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ label = "Loading…", rows = 0, className }: { label?: string; rows?: number; className?: string }) {
  if (rows > 0) {
    return (
      <div className={cn("space-y-2", className)} aria-busy="true" aria-label={label}>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)} aria-busy="true">
      <LoaderCircle className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, action }: { title?: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
      <CircleX className="size-6 text-destructive" />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {message && <p className="max-w-md text-sm text-muted-foreground">{message}</p>}
      </div>
      {action}
    </div>
  );
}
