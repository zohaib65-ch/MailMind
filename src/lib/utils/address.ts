// Client-safe address helpers (used by both the server and the draft editor).
import type { EmailAddress } from "@/schemas/common";

/** Parses `"Ada Lovelace" <ada@example.com>, bob@example.com` into addresses. */
export function parseAddressList(header: string | null | undefined): EmailAddress[] {
  if (!header) return [];
  const result: EmailAddress[] = [];
  // Split on commas that are not inside quotes.
  const parts = header.match(/(?:"[^"]*"|[^,])+/g) ?? [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const angle = /^(.*)<([^>]+)>\s*$/.exec(trimmed);
    if (angle) {
      const name = angle[1]!.trim().replace(/^"|"$/g, "").trim();
      const email = angle[2]!.trim().toLowerCase();
      if (email.includes("@")) result.push(name ? { name, email } : { email });
    } else if (trimmed.includes("@")) {
      result.push({ email: trimmed.replace(/^mailto:/i, "").toLowerCase() });
    }
  }
  return result;
}

export function formatAddressHeader(addresses: EmailAddress[]): string {
  return addresses
    .map((a) => {
      if (!a.name) return a.email;
      const name = a.name.replace(/["\\\r\n]/g, "");
      // Quote only when the name contains characters that are special in address headers.
      return /[,;:<>@()[\]]/.test(name) ? `"${name}" <${a.email}>` : `${name} <${a.email}>`;
    })
    .join(", ");
}
