// Client-safe helpers only. Server-only utilities (env, crypto, redis, …) live in their
// own modules under lib/utils and are imported by path.
export { cn } from "cn";

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function initials(nameOrEmail: string): string {
  const base = nameOrEmail.includes("@") ? nameOrEmail.split("@")[0]! : nameOrEmail;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : base.slice(0, 2)).toUpperCase();
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function displayName(address: { name?: string | null; email: string }): string {
  return address.name?.trim() || address.email;
}

export function formatAddress(address: { name?: string | null; email: string }): string {
  return address.name ? `${address.name} <${address.email}>` : address.email;
}
