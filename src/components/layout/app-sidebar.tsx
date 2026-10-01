"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/common/logo";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export type SidebarCounts = { needsReply: number; pendingDrafts: number };

export function SidebarNav({ counts, onNavigate }: { counts: SidebarCounts; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === "/inbox" && pathname.startsWith("/emails/"));
        const count = item.badgeKey ? counts[item.badgeKey] : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4" />
            <span className="flex-1">{item.label}</span>
            {count > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 text-xs font-medium tabular-nums text-primary">{count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSidebar({ counts }: { counts: SidebarCounts }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r bg-sidebar p-4 md:flex">
      <Link href="/dashboard" className="px-1.5">
        <Logo />
      </Link>
      <SidebarNav counts={counts} />
    </aside>
  );
}
