"use client";

import { LoaderCircle, PenLine, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AiDraft } from "@/components/ai/ai-draft";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import type { DraftDTO, EmailDetailDTO } from "@/types/email";

/**
 * The reply area under an email: shows the current draft for review, or offers to
 * generate one with AI (with optional instructions) or to write one by hand.
 */
export function ReplyPanel({ email, initialDraft, aiConfigured }: { email: EmailDetailDTO; initialDraft: DraftDTO | null; aiConfigured: boolean }) {
  const [draft, setDraft] = useState<DraftDTO | null>(initialDraft);
  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      const res = await api<{ draft: DraftDTO }>(`/api/emails/${email.id}/reply`, { body: { instructions: instructions || undefined } });
      setDraft(res.draft);
      setInstructions("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not draft a reply");
    } finally {
      setGenerating(false);
    }
  }

  async function writeManually() {
    try {
      const res = await api<{ draft: DraftDTO }>("/api/drafts", {
        body: {
          emailId: email.id,
          subject: /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`,
          body: `Hi ${email.from.name?.split(" ")[0] ?? ""},\n\n\n`,
        },
      });
      setDraft(res.draft);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start a reply");
    }
  }

  if (email.direction === "outbound") return null;

  const showDraft = draft && draft.status !== "discarded";
  return (
    <section id="reply" className="space-y-3 scroll-mt-20">
      {showDraft && <AiDraft key={draft.id} draft={draft} onChange={setDraft} />}
      {(!showDraft || draft.status === "sent") && (
        <Card>
          <CardHeader>
            <CardTitle>{draft?.status === "sent" ? "Reply again" : "Reply"}</CardTitle>
            <CardDescription>
              {aiConfigured ? "Let AI draft a reply using this conversation's memory — or write your own." : "Write a reply."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            {aiConfigured && (
              <>
                <Input
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Optional: what should it say? e.g. “accept, propose Tuesday 2pm”"
                  onKeyDown={(e) => e.key === "Enter" && !generating && generate()}
                  maxLength={1000}
                />
                <Button onClick={generate} disabled={generating} className="shrink-0">
                  {generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                  {generating ? "Drafting…" : "Generate AI reply"}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={writeManually} className="shrink-0">
              <PenLine /> Write manually
            </Button>
          </CardContent>
        </Card>
      )}
      {showDraft && draft.status !== "sent" && aiConfigured && (
        <div className="flex gap-2">
          <Input
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Not quite right? Tell the AI how to change it…"
            onKeyDown={(e) => e.key === "Enter" && !generating && generate()}
            maxLength={1000}
          />
          <Button variant="outline" onClick={generate} disabled={generating} className="shrink-0">
            {generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Regenerate
          </Button>
        </div>
      )}
    </section>
  );
}
