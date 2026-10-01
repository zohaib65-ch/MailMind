"use client";

import { Ban, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatAddressHeader, parseAddressList } from "@/lib/utils/address";
import type { SendApprovalRequest } from "@/types/agent";

type Edits = { to?: { name?: string; email: string }[]; subject?: string; body?: string };

/**
 * Human-in-the-loop: the agent is paused here. Nothing is sent until the user clicks
 * "Approve & send"; they can edit the email first, or reject it.
 */
export function ApprovalCard({
  approval,
  busy,
  onDecision,
}: {
  approval: SendApprovalRequest;
  busy: boolean;
  onDecision: (decision: "approve" | "reject", edits?: Edits, reason?: string) => void;
}) {
  const [to, setTo] = useState(formatAddressHeader(approval.to));
  const [subject, setSubject] = useState(approval.subject);
  const [body, setBody] = useState(approval.body);
  const recipients = parseAddressList(to);

  return (
    <Card className="border-amber-500/40 bg-amber-500/5" role="region" aria-label="Approval required">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-amber-600 dark:text-amber-400" /> Approve this email before it&apos;s sent
        </CardTitle>
        <CardDescription>The assistant has paused. Edit anything you like — it will only be sent if you approve.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-1.5">
          <Label htmlFor="approval-to">To</Label>
          <Input id="approval-to" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="approval-subject">Subject</Label>
          <Input id="approval-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="approval-body">Message</Label>
          <Textarea id="approval-body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-44 leading-relaxed" />
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => onDecision("reject", undefined, undefined)}>
          <Ban /> Don&apos;t send
        </Button>
        <Button
          disabled={busy || !recipients.length || !body.trim()}
          onClick={() => onDecision("approve", { to: recipients, subject, body })}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <Send />} Approve &amp; send
        </Button>
      </CardFooter>
    </Card>
  );
}
