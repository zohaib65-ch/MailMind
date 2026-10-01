import { apiRoute } from "@/lib/utils/http";
import { deleteMemory } from "@/services/user/settings.service";

/** Lets the user delete something the assistant remembered. */
export const DELETE = apiRoute<{ id: string }>({}, async (_req, { user, params }) => {
  await deleteMemory(user.id, params.id);
  return { ok: true };
});
