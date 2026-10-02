"use client";

import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/common/logo";
import { SearchInput } from "@/components/common/search-input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AiStatusIndicator } from "./ai-status-indicator";
import { SidebarNav, type SidebarCounts } from "./app-sidebar";
import { MailSync } from "./mail-sync";
import { UserMenu } from "./user-menu";

export function AppHeader({
  user,
  counts,
  aiConfigured,
  autoProcess,
  pollSeconds,
}: {
  user: { name: string; email: string };
  counts: SidebarCounts;
  aiConfigured: boolean;
  autoProcess: boolean;
  pollSeconds: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-4">
          <SheetHeader className="p-0 pb-4">
            <SheetTitle>
              <Logo />
            </SheetTitle>
          </SheetHeader>
          <SidebarNav counts={counts} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <SearchInput
        className="w-full max-w-md"
        placeholder="Search emails…"
        onSearch={(q) => q && router.push(`/inbox?view=all&q=${encodeURIComponent(q)}`)}
      />
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden sm:block">
          <AiStatusIndicator aiConfigured={aiConfigured} autoProcess={autoProcess} />
        </div>
        <MailSync pollSeconds={pollSeconds} />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
