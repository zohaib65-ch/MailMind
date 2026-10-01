"use client";

import { WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

/**
 * Inbox toolbar: analyse the emails the automatic pipeline hasn't reached yet (e.g. the
 * older part of a first Gmail import).
 */
export function InboxActions({ aiConfigured, pending }: { aiConfigured: boolean; pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function processAll() {
    setBusy(true);
    try {
      await api("/api/ai/process", { method: "POST" });
      const count = Math.min(pending, 100);
      toast.success(`Analysing ${count} email${count === 1 ? "" : "s"} in the background`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start processing");
    } finally {
      setBusy(false);
    }
  }

  if (!aiConfigured || pending === 0) return null;
  return (
    <Button size="sm" onClick={processAll} disabled={busy}>
      <WandSparkles /> Analyse {pending} with AI
    </Button>
  );
}
