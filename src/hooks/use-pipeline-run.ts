"use client";

import { useCallback, useState } from "react";
import { ApiError, streamEvents } from "@/lib/api-client";

export type PipelineStepState = {
  step: string;
  status: "running" | "done" | "skipped" | "error";
  detail?: string;
};

type PipelineEvent =
  | ({ type: "step" } & PipelineStepState)
  | { type: "done" }
  | { type: "error"; message: string };

/** Runs the AI pipeline for one email and exposes each step's live status. */
export function usePipelineRun(emailId: string) {
  const [steps, setSteps] = useState<PipelineStepState[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (force = false): Promise<boolean> => {
      setSteps([]);
      setError(null);
      setRunning(true);
      let ok = true;
      try {
        await streamEvents<PipelineEvent>(`/api/emails/${emailId}/process`, { force }, (event) => {
          if (event.type === "step") {
            setSteps((prev) => {
              const next = { step: event.step, status: event.status, detail: event.detail };
              return prev.some((s) => s.step === event.step) ? prev.map((s) => (s.step === event.step ? next : s)) : [...prev, next];
            });
          } else if (event.type === "error") {
            ok = false;
            setError(event.message);
          }
        });
      } catch (err) {
        ok = false;
        setError(err instanceof ApiError ? err.message : "Processing failed");
      } finally {
        setRunning(false);
      }
      return ok;
    },
    [emailId],
  );

  return { steps, running, error, start };
}
