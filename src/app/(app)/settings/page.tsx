import { CircleCheck, CircleX, Mail } from "lucide-react";
import type { Metadata } from "next";
import { RelativeTime } from "@/components/common/relative-time";
import { PageHeader } from "@/components/layout/page-header";
import { ActionButton, AiSettingsForm } from "@/components/settings/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { modelNameFor } from "@/lib/langchain/model";
import { getEnv, isAiConfigured, isGmailConfigured } from "@/lib/utils/env";
import { requireUser } from "@/services/auth/dal";
import { listAccounts } from "@/services/email/account.service";
import { getUserSettings } from "@/services/user/settings.service";

export const metadata: Metadata = { title: "Settings" };

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      {ok ? <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" /> : <CircleX className="size-4 text-muted-foreground" />}
      {children}
    </span>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, accounts] = await Promise.all([getUserSettings(user.id), listAccounts(user.id)]);
  const env = getEnv();
  const aiConfigured = isAiConfigured();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Accounts and AI behaviour." />

      <Card>
        <CardHeader>
          <CardTitle>Email accounts</CardTitle>
          <CardDescription>MailMind reads mail and sends only replies you approve. It never deletes anything.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <Mail className="size-4 text-muted-foreground" />
              <div className="min-w-48 flex-1">
                <p className="truncate text-sm font-medium">{a.emailAddress}</p>
                <p className="text-xs text-muted-foreground">
                  Gmail
                  {a.lastSyncedAt && (
                    <>
                      {" · synced "}
                      <RelativeTime iso={a.lastSyncedAt} mode="relative" />
                    </>
                  )}
                </p>
                {a.syncError && <p className="text-xs text-destructive">{a.syncError}</p>}
              </div>
              <Badge variant="secondary">{a.syncError ? "Needs attention" : "Connected"}</Badge>
              <ActionButton
                  endpoint={`/api/accounts/${a.id}`}
                  label="Disconnect"
                  icon="trash"
                  variant="destructive"
                  successMessage="Account disconnected"
                  confirm={{
                    title: "Disconnect this Gmail account?",
                    description: "MailMind deletes its copy of these emails, drafts and AI results. Your Gmail mailbox is not touched.",
                    action: "Disconnect",
                  }}
                />
            </div>
          ))}
          {accounts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {env.GMAIL_POLL_SECONDS
                ? `New mail is picked up automatically every ${env.GMAIL_POLL_SECONDS} seconds while MailMind is open.`
                : "Automatic checking is off (GMAIL_POLL_SECONDS=0). Use the Sync button to check for mail."}
            </p>
          )}
          {accounts.some((a) => a.syncError) && (
            <p className="text-xs text-muted-foreground">
              If Gmail access was revoked or expired, sign in with Google again to reconnect.
            </p>
          )}
          {isGmailConfigured() && accounts.length === 0 && (
            <Button asChild variant="outline" size="sm">
              <a href="/api/auth/google">
                <Mail /> Connect Gmail
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI</CardTitle>
          <CardDescription>How MailMind writes and what it may do on its own.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <AiSettingsForm settings={settings} />
        </CardContent>
      </Card>
    </div>
  );
}
