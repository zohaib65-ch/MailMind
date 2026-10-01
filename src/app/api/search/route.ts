import { apiRoute, parseQuery } from "@/lib/utils/http";
import { SearchQuerySchema } from "@/schemas/api";
import { searchEmails } from "@/services/search/search.service";

export const GET = apiRoute({}, async (req, { user }) => {
  const { q, mode, limit } = parseQuery(req, SearchQuerySchema);
  return searchEmails(user.id, { query: q, mode, limit });
});
