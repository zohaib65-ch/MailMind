import "server-only";
import { connectDb, isObjectId, toObjectId } from "@/lib/db/mongoose";
import { Contact } from "@/lib/db/models";
import { NotFoundError } from "@/lib/utils/errors";
import type { ContactRelationship, EmailAddress } from "@/schemas/common";
import type { ContactDTO } from "@/types/email";
import { toContactDTO } from "./dto";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Called during sync: every correspondent becomes (or updates) a contact. */
export async function recordContacts(userId: string, addresses: EmailAddress[], at: Date, selfEmail: string) {
  const seen = new Set<string>();
  const ops = addresses
    .filter((a) => {
      const key = a.email.toLowerCase();
      if (key === selfEmail.toLowerCase() || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((a) => ({
      updateOne: {
        filter: { userId: toObjectId(userId), email: a.email.toLowerCase() },
        update: {
          $setOnInsert: { relationship: "unknown" as const },
          ...(a.name ? { $set: { name: a.name } } : {}),
          $inc: { emailCount: 1 },
          $max: { lastEmailAt: at },
        },
        upsert: true,
      },
    }));
  if (ops.length) await Contact.bulkWrite(ops, { ordered: false });
}

export async function searchContacts(
  userId: string,
  options: { query?: string; relationship?: ContactRelationship; limit?: number } = {},
): Promise<ContactDTO[]> {
  await connectDb();
  const filter: Record<string, unknown> = { userId: toObjectId(userId) };
  if (options.relationship) filter.relationship = options.relationship;
  if (options.query?.trim()) {
    const rx = new RegExp(escapeRegex(options.query.trim()), "i");
    filter.$or = [{ name: rx }, { email: rx }, { company: rx }];
  }
  const contacts = await Contact.find(filter)
    .sort({ lastEmailAt: -1 })
    .limit(Math.min(options.limit ?? 50, 200))
    .lean();
  return contacts.map(toContactDTO);
}

export async function updateContact(
  userId: string,
  contactId: string,
  update: { relationship?: ContactRelationship; company?: string; name?: string },
): Promise<ContactDTO> {
  await connectDb();
  if (!isObjectId(contactId)) throw new NotFoundError("Contact");
  const contact = await Contact.findOneAndUpdate(
    { _id: toObjectId(contactId), userId: toObjectId(userId) },
    { $set: update },
    { returnDocument: "after" },
  ).lean();
  if (!contact) throw new NotFoundError("Contact");
  return toContactDTO(contact);
}

export async function getContactByEmail(userId: string, email: string) {
  await connectDb();
  return Contact.findOne({ userId: toObjectId(userId), email: email.toLowerCase() }).lean();
}
