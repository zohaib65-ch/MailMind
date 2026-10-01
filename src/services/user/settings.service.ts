import "server-only";
import { connectDb, isObjectId, toObjectId } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models";
import { NotFoundError } from "@/lib/utils/errors";
import type { UserSettingsDTO } from "@/types/email";

export async function getUserSettings(userId: string): Promise<UserSettingsDTO & { memories: { id: string; text: string; createdAt: string }[] }> {
  await connectDb();
  const user = await User.findById(toObjectId(userId)).lean();
  if (!user) throw new NotFoundError("User");
  return {
    replyTone: user.settings?.replyTone ?? "professional and friendly",
    signature: user.settings?.signature,
    summaryLength: user.settings?.summaryLength ?? "normal",
    autoDraftReplies: user.settings?.autoDraftReplies ?? true,
    autoMarkImportant: user.settings?.autoMarkImportant ?? true,
    memories: (user.memories ?? []).map((m) => ({ id: m._id.toString(), text: m.text, createdAt: m.createdAt.toISOString() })),
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

export async function deleteMemory(userId: string, memoryId: string): Promise<void> {
  await connectDb();
  if (!isObjectId(memoryId)) throw new NotFoundError("Memory");
  await User.updateOne({ _id: toObjectId(userId) }, { $pull: { memories: { _id: toObjectId(memoryId) } } });
}
