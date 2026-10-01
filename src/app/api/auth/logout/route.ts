import { apiRoute } from "@/lib/utils/http";
import { destroySession } from "@/services/auth/session.service";

export const POST = apiRoute({ public: true }, async () => {
  await destroySession();
  return { ok: true };
});
