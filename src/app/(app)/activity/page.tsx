import type { Metadata } from "next";
import { ActivityFeed } from "@/components/ai/activity-feed";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { listActivity } from "@/services/ai/activity.service";
import { requireUser } from "@/services/auth/dal";

export const metadata: Metadata = { title: "AI Activity" };

/** The full audit trail: every AI step and tool call, with model, tokens and latency. */
export default async function ActivityPage() {
  const user = await requireUser();
  const items = await listActivity(user.id, { limit: 150 });
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="AI Activity"
        description="Every pipeline step, assistant run and tool call — what ran, what it produced, and what it cost. Kept for 90 days."
      />
      <Card>
        <CardContent>
          <ActivityFeed items={items} detailed />
        </CardContent>
      </Card>
    </div>
  );
}
