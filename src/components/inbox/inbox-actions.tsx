"use client";

import { MailPlus, WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, ApiError } from "@/lib/api-client";

/** Inbox toolbar: run the AI pipeline on pending emails, and (mock mode) simulate a new email arriving. */
export function InboxActions({ mockMode, aiConfigured, pending }: { mockMode: boolean; aiConfigured: boolean; pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"process" | "simulate" | null>(null);

  async function processAll() {
    setBusy("process");
    try {
      await api("/api/ai/process", { method: "POST" });
      toast.success(`Analysing ${pending} email${pending === 1 ? "" : "s"} in the background`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start processing");
    } finally {
      setBusy(null);
    }
  }

  async function simulate() {
    setBusy("simulate");
    try {
      const { delivered } = await api<{ delivered: { subject: string } | null }>("/api/mock/simulate", { method: "POST" });
      if (delivered) toast.success(`New email: “${delivered.subject}”`, { description: aiConfigured ? "The AI pipeline is processing it now." : undefined });
      else toast.info("All demo emails have arrived. Reset the demo in Settings to start over.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not simulate an email");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {mockMode && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={simulate} disabled={busy !== null}>
              <MailPlus /> Simulate new email
            </Button>
          </TooltipTrigger>
          <TooltipContent>Deliver a new demo email and watch the AI pipeline handle it</TooltipContent>
        </Tooltip>
      )}
      {aiConfigured && pending > 0 && (
        <Button size="sm" onClick={processAll} disabled={busy !== null}>
          <WandSparkles /> Analyse {pending} with AI
        </Button>
      )}
    </>
  );
}
