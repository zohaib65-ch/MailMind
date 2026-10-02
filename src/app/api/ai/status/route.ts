import { apiRoute } from "@/lib/utils/http";
import { getProcessingStatus } from "@/services/ai/processing.service";

export const GET = apiRoute({}, async (_req, { user }) => ({ ai: await getProcessingStatus(user.id) }));
