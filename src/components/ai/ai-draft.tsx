"use client";

import { Bot, CircleCheck, LoaderCircle, Save, Send, Sparkles, Trash2, TriangleAlert, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/common/relative-time";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api-client";
import { cn, formatAddress } from "@/lib/utils";
import { formatAddressHeader, parseAddressList } from "@/lib/utils/address";
import type { DraftDTO } from "@/types/email";

const SOURCE_LABEL: Record<DraftDTO["source"], { label: string; icon: typeof Bot }> = {
  pipeline: { label: "Written by AI", icon: Sparkles },
  agent: { label: "Written by the assistant", icon: Bot },
  user: { label: "Written by you", icon: UserRound },
};

/**
 * Review → edit → send. The AI's draft is fully editable; "Send" asks for one more
 * confirmation and only then calls the send endpoint. Nothing is ever sent automatically.
 */
export function AiDraft({
  draft: initial,
  onChange,
  compact = false,
  title = "Suggested reply",
}: {
  draft: DraftDTO;
  onChange?: (draft: DraftDTO | null) => void;
  compact?: boolean;
  title?: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [to, setTo] = useState(formatAddressHeader(initial.to));
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [busy, setBusy] = useState<"save" | "send" | "discard" | null>(null);

  const editable = draft.status === "pending_review" || draft.status === "failed";
  const recipients = parseAddressList(to);
  const dirty = subject !== draft.subject || body !== draft.body || to !== formatAddressHeader(draft.to);
  const edited = draft.originalBody !== undefined && body.trim() !== draft.originalBody.trim();
  const source = SOURCE_LABEL[draft.source];

  const update = (next: DraftDTO | null) => {
    if (next) setDraft(next);
    onChange?.(next);
  };

  async function save() {
    setBusy("save");
    try {
      const { draft: saved } = await api<{ draft: DraftDTO }>(`/api/drafts/${draft.id}`, { method: "PATCH", body: { to: recipients, subject, body } });
      update(saved);
      toast.success("Draft saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setBusy("send");
    try {
      const { draft: sent } = await api<{ draft: DraftDTO }>(`/api/drafts/${draft.id}/send`, {
        body: { to: recipients, subject, body, confirm: true },
      });
      update(sent);
      toast.success(`Sent to ${sent.to.map((t) => t.name ?? t.email).join(", ")}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send");
    } finally {
      setBusy(null);
    }
  }

  async function discard() {
    setBusy("discard");
    try {
      await api(`/api/drafts/${draft.id}`, { method: "DELETE" });
      update(null);
      toast.success("Draft discarded");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not discard");
    } finally {
      setBusy(null);
    }
  }

  if (draft.status === "sent") {
    return (
      <Card className="border-emerald-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CircleCheck className="size-4" /> Reply sent
          </CardTitle>
          <CardDescription>
            “{draft.subject}” to {draft.to.map(formatAddress).join(", ")}
            {draft.sentAt && (
              <>
                {" · "}
                <RelativeTime iso={draft.sentAt} mode="relative" />
              </>
            )}
          </CardDescription>
        </CardHeader>
        {!compact && (
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{draft.body}</p>
          </CardContent>
        )}
      </Card>
    );
  }

  if (draft.status === "discarded") {
    return <p className="text-sm text-muted-foreground">Draft discarded.</p>;
  }

  return (
    <Card className={cn("border-primary/30", compact && "shadow-none")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <source.icon className="size-4 text-primary" /> {title}
        </CardTitle>
        <CardDescription>
          {source.label}
          {edited ? " · edited by you" : ""} — review it before sending.
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="text-primary">
            {draft.status === "failed" ? "Send failed" : "Waiting for your review"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {draft.status === "failed" && draft.error && (
          <p className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <TriangleAlert className="size-4" /> {draft.error}
          </p>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={`to-${draft.id}`}>To</Label>
          <Input id={`to-${draft.id}`} value={to} onChange={(e) => setTo(e.target.value)} disabled={!editable} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`subject-${draft.id}`}>Subject</Label>
          <Input id={`subject-${draft.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`body-${draft.id}`}>Message</Label>
          <Textarea
            id={`body-${draft.id}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={!editable}
            className={cn("font-[inherit] leading-relaxed", compact ? "min-h-40" : "min-h-56")}
          />
        </div>
        {draft.notes.length > 0 && (
          <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">Check before sending</p>
            <ul className="mt-1 list-disc pl-5">
              {draft.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={discard} disabled={busy !== null}>
          {busy === "discard" ? <LoaderCircle className="animate-spin" /> : <Trash2 />} Discard
        </Button>
        <Button variant="outline" size="sm" onClick={save} disabled={!dirty || busy !== null}>
          {busy === "save" ? <LoaderCircle className="animate-spin" /> : <Save />} Save
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={busy !== null || !recipients.length || !body.trim()}>
              {busy === "send" ? <LoaderCircle className="animate-spin" /> : <Send />} Send
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send this email?</AlertDialogTitle>
              <AlertDialogDescription>
                “{subject}” will be sent to {recipients.map(formatAddress).join(", ") || "nobody"}. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction onClick={send}>Send email</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
