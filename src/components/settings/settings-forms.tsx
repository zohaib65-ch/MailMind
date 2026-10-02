"use client";

import { LoaderCircle, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api-client";
import type { SummaryLength } from "@/schemas/common";
import type { UserSettingsDTO } from "@/types/email";

export function AiSettingsForm({ settings }: { settings: UserSettingsDTO }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof UserSettingsDTO>(key: K, value: UserSettingsDTO[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    try {
      await api("/api/settings", { method: "PATCH", body: form });
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-1.5">
        <Label htmlFor="tone">Reply tone</Label>
        <Input id="tone" value={form.replyTone} onChange={(e) => set("replyTone", e.target.value)} maxLength={200} />
        <p className="text-xs text-muted-foreground">Passed to the reply drafter, e.g. “warm and concise”.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="signature">Signature</Label>
        <Textarea id="signature" value={form.signature ?? ""} onChange={(e) => set("signature", e.target.value)} maxLength={500} placeholder="Best,&#10;Sam" />
      </div>
      <div className="grid gap-1.5">
        <Label>Default summary length</Label>
        <Select value={form.summaryLength} onValueChange={(v) => set("summaryLength", v as SummaryLength)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="short">Short</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="detailed">Detailed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor="autoDraft">Draft replies automatically</Label>
          <p className="text-xs text-muted-foreground">When an email needs a reply, prepare a draft for review. Drafts are never sent automatically.</p>
        </div>
        <Switch id="autoDraft" checked={form.autoDraftReplies} onCheckedChange={(v) => set("autoDraftReplies", v)} />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor="autoImportant">Mark urgent emails as important</Label>
          <p className="text-xs text-muted-foreground">High-urgency and interview emails get starred automatically.</p>
        </div>
        <Switch id="autoImportant" checked={form.autoMarkImportant} onCheckedChange={(v) => set("autoMarkImportant", v)} />
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? <LoaderCircle className="animate-spin" /> : <Save />} Save settings
      </Button>
    </div>
  );
}

export function ActionButton({
  endpoint,
  label,
  icon = "refresh",
  successMessage,
  confirm,
  variant = "outline",
}: {
  endpoint: string;
  label: string;
  icon?: "refresh" | "reset" | "trash";
  successMessage: string;
  confirm?: { title: string; description: string; action: string };
  variant?: "outline" | "destructive";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const Icon = icon === "reset" ? RotateCcw : icon === "trash" ? Trash2 : RefreshCw;
  async function run() {
    setBusy(true);
    try {
      await api(endpoint, { method: endpoint.startsWith("/api/accounts/") ? "DELETE" : "POST" });
      toast.success(successMessage);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }
  const button = (
    <Button variant={variant} size="sm" disabled={busy} onClick={confirm ? undefined : run}>
      {busy ? <LoaderCircle className="animate-spin" /> : <Icon />} {label}
    </Button>
  );
  if (!confirm) return button;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{button}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={run}>{confirm.action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
