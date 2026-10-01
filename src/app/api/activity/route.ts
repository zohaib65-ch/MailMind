import { apiRoute, parseQuery } from "@/lib/utils/http";
import { ActivityQuerySchema } from "@/schemas/api";
import { listActivity } from "@/services/ai/activity.service";

export const GET = apiRoute({}, async (req, { user }) => ({ items: await listActivity(user.id, parseQuery(req, ActivityQuerySchema)) }));
