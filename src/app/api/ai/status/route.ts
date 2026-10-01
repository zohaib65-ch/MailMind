import { apiRoute } from "@/lib/utils/http";
import { getProcessingStatus } from "@/services/ai/processing.service";
import { getIndexStatus } from "@/services/embeddings/indexer";

export const GET = apiRoute({}, async (_req, { user }) => {
  const [ai, index] = await Promise.all([getProcessingStatus(user.id), getIndexStatus(user.id)]);
  return { ai, index };
});
