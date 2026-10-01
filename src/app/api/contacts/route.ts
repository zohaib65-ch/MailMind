import { apiRoute, parseQuery } from "@/lib/utils/http";
import { ContactQuerySchema } from "@/schemas/api";
import { searchContacts } from "@/services/email/contact.service";

export const GET = apiRoute({}, async (req, { user }) => {
  const { q, relationship } = parseQuery(req, ContactQuerySchema);
  return { contacts: await searchContacts(user.id, { query: q, relationship, limit: 200 }) };
});
