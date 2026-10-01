import { apiRoute } from "@/lib/utils/http";
import { listAccounts } from "@/services/email/account.service";

export const GET = apiRoute({}, async (_req, { user }) => ({ accounts: await listAccounts(user.id) }));
