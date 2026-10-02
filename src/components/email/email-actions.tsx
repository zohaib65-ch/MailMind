"use client";

import { Archive, ArchiveRestore, Check, Mail, Reply, Sparkles, Star, WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PipelineProgress } from "@/components/ai/pipeline-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePipelineRun } from "@/hooks/use-pipeline-run";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { EmailDetailDTO } from "@/types/email";

/** Reply · Generate AI Reply · Archive · Mark Important · Mark unread · Analyse with AI. */
export function EmailActions({ email, aiConfigured }: { email: EmailDetailDTO; aiConfigured: boolean }) {
  const router = useRouter();
  const [state, setState] = useState({ archived: email.isArchived, important: email.isImportant });
  const pipeline = usePipelineRun(email.id);

  // Opening an email marks it read.
  useEffect(() => {
    if (!email.isRead) void api(`/api/emails/${email.id}`, { method: "PATCH", body: { isRead: true } }).catch(() => undefined);
  }, [email.id, email.isRead]);

  async function patch(body: Record<string, boolean>, message: string) {
    try {
      await api(`/api/emails/${email.id}`, { method: "PATCH", body });
      toast.success(message);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  async function analyse() {
    const ok = await pipeline.start(email.ai.status === "processed");
    if (ok) {
      toast.success("AI analysis complete");
      router.refresh();
    }
  }

  const scrollToReply = () => document.getElementById("reply")?.scrollIntoView({ behavior: "smooth" });
  const showPipeline = pipeline.running || pipeline.steps.length > 0 || pipeline.error;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {email.direction === "inbound" && (
          <>
            <Button size="sm" onClick={scrollToReply}>
              <Reply /> Reply
            </Button>
            {aiConfigured && (
              <Button size="sm" variant="outline" onClick={scrollToReply}>
                <Sparkles /> <span className="sm:hidden">AI reply</span>
                <span className="hidden sm:inline">Generate AI reply</span>
              </Button>
            )}
          </>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            setState((s) => ({ ...s, archived: !s.archived }));
            await patch({ isArchived: !state.archived }, state.archived ? "Moved back to inbox" : "Archived");
          }}
        >
          {state.archived ? <ArchiveRestore /> : <Archive />}
          <span className="sr-only md:not-sr-only">{state.archived ? "Unarchive" : "Archive"}</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={state.important}
          onClick={async () => {
            setState((s) => ({ ...s, important: !s.important }));
            await patch({ isImportant: !state.important }, state.important ? "Unmarked important" : "Marked as important");
          }}
        >
          <Star className={cn(state.important && "fill-amber-400 text-amber-400")} />
          <span className="sr-only md:not-sr-only">{state.important ? "Important" : "Mark important"}</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => patch({ isRead: false }, "Marked as unread")}>
          <Mail /> <span className="sr-only md:not-sr-only">Mark unread</span>
        </Button>
        {email.replyStatus === "needs_reply" && (
          <Button size="sm" variant="ghost" onClick={() => patch({ replyHandled: true }, "Marked as handled")}>
            <Check /> Handled
          </Button>
        )}
        {aiConfigured && (
          <Button size="sm" variant="ghost" onClick={analyse} disabled={pipeline.running} className="xl:ml-auto">
            <WandSparkles />
            <span className="sr-only md:not-sr-only">{email.ai.status === "processed" ? "Re-analyse" : "Analyse with AI"}</span>
          </Button>
        )}
      </div>
      {showPipeline && (
        <Card>
          <CardHeader>
            <CardTitle>AI pipeline</CardTitle>
            <CardDescription>{pipeline.running ? "Running each step…" : pipeline.error ? "Stopped with an error" : "Finished"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <PipelineProgress steps={pipeline.steps} running={pipeline.running} />
            {pipeline.error && <p className="text-sm text-destructive">{pipeline.error}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
