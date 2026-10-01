import { CircleCheck, CircleDashed, CircleX, LoaderCircle, MinusCircle } from "lucide-react";
import type { PipelineStepState } from "@/hooks/use-pipeline-run";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<string, string> = {
  classify: "AI Classifier",
  extract: "Information Extractor",
  summarize: "Summarizer",
  urgency: "Urgency Detector",
  decide: "Action Decision",
  act: "Tools (automatic actions)",
  draft: "Draft Reply",
  memory: "Conversation Memory",
  finalize: "Save results",
};

const ORDER = Object.keys(STEP_LABELS);

/** Live view of the LangGraph pipeline: each node lights up as it runs. */
export function PipelineProgress({ steps, running }: { steps: PipelineStepState[]; running: boolean }) {
  const byStep = new Map(steps.map((s) => [s.step, s]));
  const visible = ORDER.filter((s) => byStep.has(s) || running);
  return (
    <ol className="space-y-1.5" aria-live="polite">
      {visible.map((step) => {
        const state = byStep.get(step);
        const Icon =
          state?.status === "done"
            ? CircleCheck
            : state?.status === "running"
              ? LoaderCircle
              : state?.status === "error"
                ? CircleX
                : state?.status === "skipped"
                  ? MinusCircle
                  : CircleDashed;
        return (
          <li key={step} className="flex items-start gap-2 text-sm">
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                state?.status === "done" && "text-emerald-600 dark:text-emerald-400",
                state?.status === "running" && "animate-spin text-primary",
                state?.status === "error" && "text-destructive",
                (!state || state.status === "skipped") && "text-muted-foreground",
              )}
            />
            <span className={cn(!state && "text-muted-foreground")}>{STEP_LABELS[step]}</span>
            {state?.detail && <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{state.detail}</span>}
          </li>
        );
      })}
    </ol>
  );
}
