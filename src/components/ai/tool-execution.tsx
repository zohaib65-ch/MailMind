import { CircleCheck, CircleX, Clock, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityStep } from "@/types/agent";

/** One tool call in the activity timeline: "🔎 Searching emails…" → "✓ Found 8 emails". */
export function ToolExecution({ step }: { step: ActivityStep }) {
  const StatusIcon =
    step.status === "running" ? LoaderCircle : step.status === "error" ? CircleX : step.status === "awaiting_approval" ? Clock : CircleCheck;
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className="w-5 shrink-0 text-center" aria-hidden>
        {step.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn(step.status === "running" ? "text-foreground" : "text-muted-foreground")}>{step.label}</p>
        {step.detail && (
          <p
            className={cn(
              "flex items-center gap-1 text-xs",
              step.status === "error" ? "text-destructive" : step.status === "awaiting_approval" ? "text-amber-600 dark:text-amber-400" : "text-foreground/80",
            )}
          >
            <StatusIcon className="size-3.5 shrink-0" />
            <span className="truncate">{step.detail}</span>
          </p>
        )}
      </div>
      {step.status === "running" && <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary" aria-label="Running" />}
    </li>
  );
}
