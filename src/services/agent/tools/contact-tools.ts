import "server-only";
import { z } from "zod";
import { ContactRelationshipSchema } from "@/schemas/common";
import { searchContacts as findContacts } from "@/services/email/contact.service";
import { defineAgentTool, type AgentToolContext } from "./define-tool";

export function contactTools(ctx: AgentToolContext) {
  const searchContacts = defineAgentTool(ctx, {
    name: "searchContacts",
    icon: "👥",
    description:
      "Look up people the user emails with. Use it to resolve 'my manager', 'clients', 'the recruiter' (filter by relationship) or a partial name into email addresses before searching emails.",
    schema: z.object({
      query: z.string().optional().describe("Part of a name, email address or company."),
      relationship: ContactRelationshipSchema.optional(),
    }),
    label: () => "Looking up contacts…",
    run: async (input) => {
      const contacts = await findContacts(ctx.userId, { query: input.query, relationship: input.relationship, limit: 20 });
      return {
        result: {
          count: contacts.length,
          contacts: contacts.map((c) => ({
            name: c.name ?? null,
            email: c.email,
            company: c.company ?? null,
            relationship: c.relationship,
            emailCount: c.emailCount,
            lastEmailAt: c.lastEmailAt ?? null,
          })),
        },
        summary: `Found ${contacts.length} contact${contacts.length === 1 ? "" : "s"}`,
      };
    },
  });
  return [searchContacts];
}
