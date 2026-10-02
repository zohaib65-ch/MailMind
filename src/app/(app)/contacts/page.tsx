import { Users } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/common/states";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/services/auth/dal";
import { searchContacts } from "@/services/email/contact.service";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage() {
  const user = await requireUser();
  const contacts = await searchContacts(user.id, { limit: 200 });
  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts"
        description="Everyone you email with. Set relationships to keep track of who is who."
      />
      {contacts.length ? <ContactsTable contacts={contacts} /> : <EmptyState icon={Users} title="No contacts yet" description="Contacts appear as emails sync." />}
    </div>
  );
}
