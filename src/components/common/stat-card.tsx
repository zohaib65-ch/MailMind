import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  hint?: string;
  href?: string;
  tone?: "default" | "attention" | "ai";
}) {
  const body = (
    <Card className={cn("h-full transition-colors", href && "hover:bg-muted/40")}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
            tone === "attention" && "bg-orange-500/10 text-orange-600 dark:text-orange-400",
            tone === "ai" && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {body}
    </Link>
  ) : (
    body
  );
}
