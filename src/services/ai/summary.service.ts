import "server-only";
import { Email, User } from "@/lib/db/models";
import type { SummaryLength } from "@/schemas/common";
import { getOwnedEmail } from "@/services/email/email.service";
import { trackAiTask } from "./ai-task.service";
import { toPromptEmail } from "./context";
import { summarizeEmail } from "./steps/summarizer";

const FIELD: Record<SummaryLength, "summaryShort" | "summary" | "summaryDetailed"> = {
  short: "summaryShort",
  normal: "summary",
  detailed: "summaryDetailed",
};

/** Returns the summary at the requested length, generating and caching it on first use. */
export async function getEmailSummary(
  userId: string,
  emailId: string,
  length: SummaryLength,
  options: { regenerate?: boolean } = {},
): Promise<string> {
  const email = await getOwnedEmail(userId, emailId);
  const cached = email.ai?.[FIELD[length]];
  if (cached && !options.regenerate) return cached;

  const owner = await User.findById(email.userId).select("name email").lean();
  const user = { name: owner?.name ?? owner?.email ?? "the user", email: owner?.email ?? "" };
  const summary = await trackAiTask({ userId, emailId, type: "summarize", input: { length } }, async () => {
    const r = await summarizeEmail(user, toPromptEmail(email), length);
    return { result: r.data, output: { summary: r.data }, usage: r.usage, model: r.model };
  });
  await Email.updateOne({ _id: email._id }, { $set: { [`ai.${FIELD[length]}`]: summary } });
  return summary;
}
