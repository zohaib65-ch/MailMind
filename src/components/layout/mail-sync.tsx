"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type SyncResponse = { created: number; updated: number; errors: string[] };

/** Never poll more often than this, even when the window regains focus repeatedly. */
const MIN_GAP_MS = 15_000;

/**
 * Keeps the inbox current. While a tab is open and visible it asks the server to check
 * Gmail every `pollSeconds` (and when the window regains focus); each check replays only
 * Gmail's change history, so it's cheap. The button runs a check on demand.
 */
export function MailSync({ pollSeconds }: { pollSeconds: number }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);
  const lastRun = useRef(0);
  const lastError = useRef<string | null>(null);

  const sync = useCallback(
    async (background: boolean) => {
      if (busy.current) return;
      busy.current = true;
      lastRun.current = Date.now();
      if (!background) setSyncing(true);
      try {
        const res = await api<SyncResponse>("/api/sync", { method: "POST", body: { background } });
        if (res.created) toast.success(`${res.created} new email${res.created === 1 ? "" : "s"}`);
        else if (!background) toast.success("Inbox is up to date");
        if (res.created || res.updated || !background) router.refresh();
        // Show a sync problem (e.g. Gmail access revoked) once, not on every poll.
        const error = res.errors[0] ?? null;
        if (error && (error !== lastError.current || !background)) toast.error(`Gmail sync failed: ${error}`);
        lastError.current = error;
      } catch (err) {
        if (!background) toast.error(err instanceof ApiError ? err.message : "Sync failed");
      } finally {
        busy.current = false;
        if (!background) setSyncing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!pollSeconds) return;
    const tick = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun.current >= MIN_GAP_MS) void sync(true);
    };
    tick();
    const timer = setInterval(tick, pollSeconds * 1000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [pollSeconds, sync]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" onClick={() => sync(false)} disabled={syncing}>
          <RefreshCw className={cn(syncing && "animate-spin")} />
          Sync
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {pollSeconds ? `Checks Gmail automatically every ${pollSeconds}s while this tab is open` : "Check Gmail for new mail"}
      </TooltipContent>
    </Tooltip>
  );
}
