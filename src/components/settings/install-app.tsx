"use client";

import { CircleCheck, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type InstallState, useInstallApp } from "@/hooks/use-install-app";

const HINTS: Record<Exclude<InstallState, "installed">, string> = {
  checking: "",
  available: "Opens MailMind in its own window, with an icon on your desktop or home screen.",
  ios: "On iPhone and iPad, tap Share in Safari, then “Add to Home Screen”.",
  manual:
    "Your browser hasn't offered to install MailMind. In Chrome or Edge, use the install icon in the address bar or “Install MailMind” in the browser menu. Firefox can't install web apps.",
};

export function InstallApp() {
  const { state, install } = useInstallApp();

  async function onInstall() {
    try {
      if ((await install()) === "accepted") toast.success("MailMind installed");
    } catch {
      toast.error("Could not open the install prompt");
    }
  }

  if (state === "installed") {
    return (
      <p className="flex items-center gap-1.5 text-sm">
        <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
        MailMind is installed on this device.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={onInstall} disabled={state !== "available"}>
        <Download /> Install app
      </Button>
      <p className="text-xs text-muted-foreground">{HINTS[state]}</p>
    </div>
  );
}
