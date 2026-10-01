import {
  Activity,
  Bot,
  FilePenLine,
  Inbox,
  LayoutDashboard,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; badgeKey?: "needsReply" | "pendingDrafts" };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox, badgeKey: "needsReply" },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/drafts", label: "Drafts", icon: FilePenLine, badgeKey: "pendingDrafts" },
  { href: "/search", label: "Search", icon: Search },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/activity", label: "AI Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];
