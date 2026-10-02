import { BrainCircuit, FilePenLine, Mail, MailOpen, Reply, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AiNotConfiguredNotice } from "@/components/common/ai-not-configured";
import { StatCard } from "@/components/common/stat-card";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { UrgencySummary } from "@/components/dashboard/urgency-summary";
import { EmailList } from "@/components/inbox/email-list";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAiConfigured } from "@/lib/utils/env";
import { requireUser } from "@/services/auth/dal";
import { getDashboardStats, getPriorityEmails } from "@/services/dashboard/dashboard.service";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [stats, priority] = await Promise.all([getDashboardStats(user.id), getPriorityEmails(user.id)]);
  const aiConfigured = isAiConfigured();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description={
          stats.aiPending
            ? `${stats.aiPending} email${stats.aiPending === 1 ? " is" : "s are"} waiting for AI analysis.`
            : "Here's what needs your attention."
        }
      />
      {!aiConfigured && <AiNotConfiguredNotice />}

      <section aria-label="Inbox summary" className="@container">
        <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @4xl:grid-cols-5">
          <StatCard label="Total emails" value={stats.total} icon={Mail} href="/inbox?view=all" />
          <StatCard label="Unread" value={stats.unread} icon={MailOpen} href="/inbox?view=unread" />
          <StatCard label="Important" value={stats.important} icon={Star} href="/inbox?view=important" />
          <StatCard label="Needs reply" value={stats.needsReply} icon={Reply} href="/inbox?view=needs_reply" tone="attention" />
          <StatCard
            label="AI processed"
            value={stats.aiProcessed}
            icon={BrainCircuit}
            tone="ai"
            hint={stats.aiFailed ? `${stats.aiFailed} failed` : undefined}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Needs your attention</CardTitle>
              <CardDescription>High-urgency emails and emails waiting for your reply</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/inbox?view=needs_reply">View all</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <EmailList
                emails={priority}
                emptyTitle="You're all caught up"
                emptyDescription={aiConfigured ? "Nothing urgent and nothing waiting for a reply." : "Priorities appear once AI has analysed your emails."}
              />
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {stats.pendingDrafts > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FilePenLine className="size-4 text-primary" />
                  {stats.pendingDrafts} draft{stats.pendingDrafts === 1 ? "" : "s"} to review
                </CardTitle>
                <CardDescription>AI-written replies wait here until you approve them.</CardDescription>
                <CardAction>
                  <Button asChild size="sm">
                    <Link href="/drafts">Review</Link>
                  </Button>
                </CardAction>
              </CardHeader>
            </Card>
          )}
          <UrgencySummary data={stats.byUrgency} />
          <CategoryBreakdown data={stats.byCategory} />
        </div>
      </div>
    </div>
  );
}
