import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmailViewer } from "@/components/email/email-viewer";
import { isAiConfigured } from "@/lib/utils/env";
import { NotFoundError } from "@/lib/utils/errors";
import { requireUser } from "@/services/auth/dal";
import { getLatestDraftForEmail } from "@/services/email/draft.service";
import { getEmailDetail } from "@/services/email/email.service";
import { getUserSettings } from "@/services/user/settings.service";

export const metadata: Metadata = { title: "Email" };

export default async function EmailPage({ params }: PageProps<"/emails/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [email, draft, settings] = await Promise.all([
    getEmailDetail(user.id, id).catch((err) => {
      if (err instanceof NotFoundError) notFound();
      throw err;
    }),
    getLatestDraftForEmail(user.id, id),
    getUserSettings(user.id),
  ]);
  return <EmailViewer email={email} draft={draft} aiConfigured={isAiConfigured()} summaryLength={settings.summaryLength} />;
}
