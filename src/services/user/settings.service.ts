import "server-only";
import { connectDb, toObjectId } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models";
import { NotFoundError } from "@/lib/utils/errors";
import type { UserSettingsDTO } from "@/types/email";

export async function getUserSettings(userId: string): Promise<UserSettingsDTO> {
  await connectDb();
  const user = await User.findById(toObjectId(userId)).lean();
  if (!user) throw new NotFoundError("User");
  return {
    replyTone: user.settings?.replyTone ?? "professional and friendly",
    signature: user.settings?.signature,
    summaryLength: user.settings?.summaryLength ?? "normal",
    autoDraftReplies: user.settings?.autoDraftReplies ?? true,
    autoMarkImportant: user.settings?.autoMarkImportant ?? true,
  };
}

export async function updateUserSettings(userId: string, update: Partial<UserSettingsDTO>): Promise<void> {
  await connectDb();
  const set = Object.fromEntries(
    Object.entries(update)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [`settings.${k}`, v]),
  );
  if (Object.keys(set).length) await User.updateOne({ _id: toObjectId(userId) }, { $set: set });
}
