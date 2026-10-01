import "server-only";
import { connectDb, toObjectId } from "@/lib/db/mongoose";
import { Email, EmailThread, User, type IEmail, type IEmailThread, type IUser } from "@/lib/db/models";
import type { PromptEmail } from "@/lib/langchain/prompts";
import { NotFoundError } from "@/lib/utils/errors";
import type { ReplyContext } from "./steps/reply-drafter";
import type { StepUser } from "./steps/types";

/** Loads what the AI steps need about one email: the email, its user and its thread. */
export type EmailContext = {
  user: IUser;
  stepUser: StepUser;
  email: IEmail;
  thread: IEmailThread;
  threadEmails: IEmail[];
};

export function toPromptEmail(email: Pick<IEmail, "from" | "to" | "cc" | "subject" | "receivedAt" | "bodyText">): PromptEmail {
  return {
    from: email.from,
    to: email.to,
    cc: email.cc,
    subject: email.subject,
    receivedAt: email.receivedAt,
    bodyText: email.bodyText,
  };
}

export async function loadEmailContext(userId: string, emailId: string): Promise<EmailContext> {
  await connectDb();
  const email = (await Email.findOne({ _id: toObjectId(emailId), userId: toObjectId(userId) }).lean()) as IEmail | null;
  if (!email) throw new NotFoundError("Email");
  const [user, thread, threadEmails] = await Promise.all([
    User.findById(email.userId).lean(),
    EmailThread.findById(email.threadId).lean(),
    Email.find({ threadId: email.threadId }).sort({ receivedAt: 1 }).lean(),
  ]);
  if (!user || !thread) throw new NotFoundError("Email context");
  return {
    user: user as IUser,
    stepUser: { name: user.name ?? user.email.split("@")[0]!, email: user.email },
    email,
    thread: thread as IEmailThread,
    threadEmails: threadEmails as IEmail[],
  };
}

export function buildReplyContext(ctx: EmailContext, instructions?: string): ReplyContext {
  const earlier = ctx.threadEmails
    .filter((m) => m.receivedAt < ctx.email.receivedAt && !m._id.equals(ctx.email._id))
    .map((m) => ({ ...toPromptEmail(m), direction: m.direction }));
  return {
    user: {
      name: ctx.stepUser.name,
      email: ctx.stepUser.email,
      tone: ctx.user.settings?.replyTone ?? "professional and friendly",
      signature: ctx.user.settings?.signature,
      notes: (ctx.user.memories ?? []).map((m) => m.text).slice(-20),
    },
    email: toPromptEmail(ctx.email),
    earlier,
    memory: ctx.thread.memory,
    instructions,
  };
}
