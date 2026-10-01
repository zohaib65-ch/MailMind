import type { Metadata } from "next";
import { AiNotConfiguredNotice } from "@/components/common/ai-not-configured";
import { EmailList } from "@/components/inbox/email-list";
import { InboxActions } from "@/components/inbox/inbox-actions";
import { InboxFilters } from "@/components/inbox/inbox-filters";
import { Pagination } from "@/components/inbox/pagination";
import { PageHeader } from "@/components/layout/page-header";
import { isAiConfigured } from "@/lib/utils/env";
import { InboxQuerySchema } from "@/schemas/api";
import { getProcessingStatus } from "@/services/ai/processing.service";
import { requireUser } from "@/services/auth/dal";
import { listEmails } from "@/services/email/email.service";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const user = await requireUser();
  const raw = await searchParams;
  const parsed = InboxQuerySchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string")));
  const query = parsed.success ? parsed.data : {};
  const [result, status] = await Promise.all([listEmails(user.id, query), getProcessingStatus(user.id)]);
  const aiConfigured = isAiConfigured();

  const hrefFor = (page: number) => {
    const params = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
    params.set("page", String(page));
    return `/inbox?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Inbox"
        description={`${result.total} email${result.total === 1 ? "" : "s"}${query.q ? ` matching “${query.q}”` : ""}`}
        actions={<InboxActions aiConfigured={aiConfigured} pending={status.pending} />}
      />
      {!aiConfigured && <AiNotConfiguredNotice />}
      <InboxFilters />
      <EmailList
        emails={result.items}
        emptyTitle={query.q || query.category || query.urgency ? "No emails match these filters" : "Nothing here"}
        emptyDescription={query.view === "needs_reply" ? "No emails are waiting for your reply." : undefined}
      />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={hrefFor} />
    </div>
  );
}
