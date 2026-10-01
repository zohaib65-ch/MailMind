import { apiRoute, parseBody } from "@/lib/utils/http";
import { SettingsPatchSchema } from "@/schemas/api";
import { getUserSettings, updateUserSettings } from "@/services/user/settings.service";

export const GET = apiRoute({}, async (_req, { user }) => ({ settings: await getUserSettings(user.id) }));

export const PATCH = apiRoute({}, async (req, { user }) => {
  await updateUserSettings(user.id, await parseBody(req, SettingsPatchSchema));
  return { settings: await getUserSettings(user.id) };
});
