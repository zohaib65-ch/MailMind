import { CircleCheck, CircleX, Mail } from "lucide-react";
import type { Metadata } from "next";
import { RelativeTime } from "@/components/common/relative-time";
import { PageHeader } from "@/components/layout/page-header";
import { ActionButton, AiSettingsForm, MemoryList } from "@/components/settings/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { modelNameFor } from "@/lib/langchain/model";
import { getEnv, isAiConfigured, isGmailConfigured } from "@/lib/utils/env";
import { requireUser } from "@/services/auth/dal";
import { listAccounts } from "@/services/email/account.service";
import { getIndexStatus } from "@/services/embeddings/indexer";
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
  const [settings, accounts, index] = await Promise.all([getUserSettings(user.id), listAccounts(user.id), getIndexStatus(user.id)]);
  const env = getEnv();
  const aiConfigured = isAiConfigured();
  const hasMock = accounts.some((a) => a.provider === "mock");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Accounts, AI behaviour, memory and search." />

      <Card>
        <CardHeader>
          <CardTitle>Email accounts</CardTitle>
          <CardDescription>MailMind reads mail and sends only replies you approve. It never deletes anything.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <Mail className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.emailAddress}</p>
                <p className="text-xs text-muted-foreground">
                  {a.provider === "mock" ? "Mock inbox (demo data)" : "Gmail"}
                  {a.lastSyncedAt && (
                    <>
                      {" · synced "}
                      <RelativeTime iso={a.lastSyncedAt} mode="relative" />
                    </>
                  )}
                </p>
                {a.syncError && <p className="text-xs text-destructive">{a.syncError}</p>}
              </div>
              <Badge variant="secondary">{a.provider === "mock" ? "Mock mode" : "Connected"}</Badge>
              {a.provider === "gmail" && (
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
              )}
            </div>
          ))}
          {isGmailConfigured() && !accounts.some((a) => a.provider === "gmail") && (
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
          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-muted/50 p-3">
            <Status ok={aiConfigured}>{aiConfigured ? "Claude connected" : "ANTHROPIC_API_KEY not set"}</Status>
            {aiConfigured && (
              <>
                <span className="text-sm text-muted-foreground">
                  Agent &amp; drafts: <code>{modelNameFor("agent")}</code>
                </span>
                <span className="text-sm text-muted-foreground">
                  Pipeline: <code>{modelNameFor("classify")}</code>
                </span>
              </>
            )}
          </div>
          <AiSettingsForm settings={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assistant memory</CardTitle>
          <CardDescription>Facts the assistant saved when you asked it to remember something. Used in every conversation and reply.</CardDescription>
        </CardHeader>
        <CardContent>
          <MemoryList memories={settings.memories} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Semantic search index</CardTitle>
          <CardDescription>Email chunks embedded for vector search (MongoDB Atlas Vector Search, or exact cosine as a fallback).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-1 sm:grid-cols-2">
            <span className="text-muted-foreground">
              Provider: <span className="text-foreground">{index.provider === "voyage" ? "Voyage AI" : "Mock (offline, lexical)"}</span>
            </span>
            <span className="text-muted-foreground">
              Model: <code className="text-foreground">{index.model}</code> · {index.dimensions} dims
            </span>
            <span className="text-muted-foreground">
              Indexed: <span className="text-foreground">{index.indexed} / {index.total} emails</span>
            </span>
            <span className="text-muted-foreground">
              Chunks: <span className="text-foreground">{index.chunks}</span>
            </span>
          </div>
          <ActionButton endpoint="/api/embeddings/reindex" label="Index missing emails" successMessage="Indexing in the background" />
        </CardContent>
      </Card>

      {env.MOCK_EMAIL_MODE && hasMock && (
        <Card>
          <CardHeader>
            <CardTitle>Demo tools</CardTitle>
            <CardDescription>Mock Email Mode helpers.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <ActionButton endpoint="/api/mock/simulate" label="Simulate a new email" successMessage="New demo email delivered" />
            <ActionButton
              endpoint="/api/mock/reset"
              label="Reset demo data"
              icon="reset"
              variant="destructive"
              successMessage="Demo inbox reset"
              confirm={{
                title: "Reset the demo inbox?",
                description: "This deletes the demo emails, drafts, conversations, saved memories and AI results, then reloads the original demo inbox.",
                action: "Reset",
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
