"use client";

import { ChevronRight, Wrench } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ActivityStep } from "@/types/agent";
import { ToolExecution } from "./tool-execution";

/**
 * What the agent did, step by step. Built only from tool calls and their results — the
 * model's private reasoning is never shown.
 */
export function AgentActivity({ steps, live = false }: { steps: ActivityStep[]; live?: boolean }) {
  const [open, setOpen] = useState(live);
  if (!steps.length) return null;
  const running = steps.some((s) => s.status === "running");
  const expanded = open || running || live;
  const done = steps.filter((s) => s.status === "done").length;
  return (
    <div className="rounded-lg border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground"
        aria-expanded={expanded}
      >
        <Wrench className="size-3.5" />
        AI activity · {done}/{steps.length} step{steps.length === 1 ? "" : "s"}
        <ChevronRight className={cn("ml-auto size-3.5 transition-transform", expanded && "rotate-90")} />
      </button>
      {expanded && (
        <ol className="space-y-2 border-t px-3 py-2.5">
          {steps.map((step) => (
            <ToolExecution key={step.id} step={step} />
          ))}
        </ol>
      )}
    </div>
  );
}
