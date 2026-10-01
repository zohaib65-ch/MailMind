import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/common/states";
import type { EmailListItemDTO } from "@/types/email";
import { EmailCard } from "./email-card";

export function EmailList({
  emails,
  emptyTitle = "No emails here",
  emptyDescription,
  emptyAction,
}: {
  emails: EmailListItemDTO[];
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
}) {
  if (!emails.length) return <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  return (
    <ul className="space-y-2">
      {emails.map((email) => (
        <li key={email.id}>
          <EmailCard email={email} />
        </li>
      ))}
    </ul>
  );
}
