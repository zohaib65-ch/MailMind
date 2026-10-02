"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/common/relative-time";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api-client";
import { CONTACT_RELATIONSHIPS, type ContactRelationship } from "@/schemas/common";
import type { ContactDTO } from "@/types/email";

/** Contacts with an editable relationship label (manager, client, …). */
export function ContactsTable({ contacts: initial }: { contacts: ContactDTO[] }) {
  const [contacts, setContacts] = useState(initial);

  async function setRelationship(id: string, relationship: ContactRelationship) {
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, relationship } : c)));
    try {
      await api(`/api/contacts/${id}`, { method: "PATCH", body: { relationship } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update contact");
    }
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Company</TableHead>
            <TableHead>Relationship</TableHead>
            <TableHead className="text-right">Emails</TableHead>
            <TableHead className="hidden text-right md:table-cell">Last email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <p className="font-medium">{c.name ?? c.email}</p>
                {c.name && <p className="text-xs text-muted-foreground">{c.email}</p>}
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">{c.company ?? "—"}</TableCell>
              <TableCell>
                <Select value={c.relationship} onValueChange={(v) => setRelationship(c.id, v as ContactRelationship)}>
                  <SelectTrigger size="sm" className="w-32 capitalize" aria-label={`Relationship with ${c.name ?? c.email}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_RELATIONSHIPS.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-right tabular-nums">{c.emailCount}</TableCell>
              <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                {c.lastEmailAt ? <RelativeTime iso={c.lastEmailAt} mode="relative" /> : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
