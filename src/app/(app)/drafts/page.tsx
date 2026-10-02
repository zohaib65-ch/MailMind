import { FilePenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AiDraft } from "@/components/ai/ai-draft";
import { RelativeTime } from "@/components/common/relative-time";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/layout/page-header";
import { displayName } from "@/lib/utils";
import { requireUser } from "@/services/auth/dal";
import { listDrafts } from "@/services/email/draft.service";

export const metadata: Metadata = { title: "Drafts" };

/** The approval queue: every AI-written reply waits here until you send or discard it. */
export default async function DraftsPage() {
  const user = await requireUser();
  const drafts = await listDrafts(user.id);
  return (
    <div className=" space-y-5">
      <PageHeader
        title="Drafts"
        description="Replies prepared by AI or by you. Nothing here is sent until you click Send."
      />
      {drafts.length === 0 ? (
        <EmptyState
          icon={FilePenLine}
          title="No drafts waiting"
          description="When MailMind drafts a reply — automatically or from an email page — it appears here for review."
        />
      ) : (
        <ul className="space-y-6">
          {drafts.map((draft) => (
            <li key={draft.id} className="space-y-2">
              {draft.replyTo && draft.emailId && (
                <p className="text-sm text-muted-foreground">
                  Reply to{" "}
                  <Link href={`/emails/${draft.emailId}`} className="font-medium text-foreground hover:underline">
                    {displayName(draft.replyTo.from)} — “{draft.replyTo.subject}”
                  </Link>{" "}
                  · <RelativeTime iso={draft.replyTo.receivedAt} mode="relative" />
                </p>
              )}
              <AiDraft draft={draft} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
