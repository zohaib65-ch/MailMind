import { FilePenLine, Inbox, LayoutDashboard, Settings, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; badgeKey?: "needsReply" | "pendingDrafts" };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox, badgeKey: "needsReply" },
  { href: "/drafts", label: "Drafts", icon: FilePenLine, badgeKey: "pendingDrafts" },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];
