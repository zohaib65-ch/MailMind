import { apiRoute, parseQuery } from "@/lib/utils/http";
import { InboxQuerySchema } from "@/schemas/api";
import { listEmails } from "@/services/email/email.service";

export const GET = apiRoute({}, async (req, { user }) => listEmails(user.id, parseQuery(req, InboxQuerySchema)));
