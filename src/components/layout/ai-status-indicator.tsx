"use client";

import { BrainCircuit, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api-client";

type Status = { ai: { aiConfigured: boolean; pending: number; processing: number; failed: number } };

/**
 * Shows whether the AI pipeline is working in the background. Polls while there is work in
 * progress and refreshes the page data when it finishes, so new categories and summaries
 * appear without a manual reload.
 */
export function AiStatusIndicator({ aiConfigured, autoProcess }: { aiConfigured: boolean; autoProcess: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const wasBusy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = await api<Status>("/api/ai/status");
        if (cancelled) return;
        setStatus(next);
        // "Busy" = work that is actually happening (or about to, when auto-processing is on).
        const busy = next.ai.processing > 0 || (autoProcess && next.ai.aiConfigured && next.ai.pending > 0);
        if (wasBusy.current && !busy) router.refresh();
        wasBusy.current = busy;
        timer = setTimeout(poll, busy ? 4_000 : 30_000);
      } catch {
        timer = setTimeout(poll, 30_000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [router, autoProcess]);

  if (!aiConfigured) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/settings" className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
            <BrainCircuit className="size-3.5" /> AI off
          </Link>
        </TooltipTrigger>
        <TooltipContent>Set GEMINI_API_KEY to enable classification, summaries and drafts.</TooltipContent>
      </Tooltip>
    );
  }

  const processing = status?.ai.processing ?? 0;
  const pending = status?.ai.pending ?? 0;
  if (!processing && pending && !autoProcess) {
    return (
      <Link href="/inbox" className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
        <BrainCircuit className="size-3.5 text-primary" /> {pending} not analysed
      </Link>
    );
  }
  const working = processing + (autoProcess ? pending : 0);
  if (!working) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
        <BrainCircuit className="size-3.5 text-primary" /> AI ready
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary" aria-live="polite">
      <LoaderCircle className="size-3.5 animate-spin" /> Analysing {working} email{working === 1 ? "" : "s"}…
    </span>
  );
}
