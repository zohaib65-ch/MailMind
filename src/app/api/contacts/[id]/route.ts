import { apiRoute, parseBody } from "@/lib/utils/http";
import { ContactPatchSchema } from "@/schemas/api";
import { updateContact } from "@/services/email/contact.service";

export const PATCH = apiRoute<{ id: string }>({}, async (req, { user, params }) => ({
  contact: await updateContact(user.id, params.id, await parseBody(req, ContactPatchSchema)),
}));
