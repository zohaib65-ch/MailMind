"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function SyncButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  async function sync() {
    setSyncing(true);
    try {
      const { created } = await api<{ created: number }>("/api/sync", { method: "POST" });
      toast.success(created ? `${created} new email${created === 1 ? "" : "s"}` : "Inbox is up to date");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
      <RefreshCw className={cn(syncing && "animate-spin")} />
      Sync
    </Button>
  );
}
