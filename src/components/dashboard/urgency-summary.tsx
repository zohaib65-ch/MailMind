import { CircleDashed, Clock, Flame, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Urgency } from "@/schemas/common";

const LEVELS: { urgency: Urgency; label: string; icon: LucideIcon; iconClass: string }[] = [
  { urgency: "high", label: "High", icon: Flame, iconClass: "text-red-600 dark:text-red-400" },
  { urgency: "medium", label: "Medium", icon: Clock, iconClass: "text-amber-600 dark:text-amber-400" },
  { urgency: "low", label: "Low", icon: CircleDashed, iconClass: "text-muted-foreground" },
];

/** Three numbers, not a chart: urgency is a short ordered list, each with icon + label. */
export function UrgencySummary({ data }: { data: { urgency: Urgency; count: number }[] }) {
  const counts = new Map(data.map((d) => [d.urgency, d.count]));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Urgency</CardTitle>
        <CardDescription>Open emails, as judged by the urgency detector</CardDescription>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-3 grid-cols-1 gap-2">
        {LEVELS.map((level) => (
          <Link
            key={level.urgency}
            href={`/inbox?urgency=${level.urgency}`}
            className="rounded-lg border p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <level.icon className={`size-3.5 ${level.iconClass}`} />
              {level.label}
            </span>
            <span className="mt-1 block text-2xl font-semibold">{counts.get(level.urgency) ?? 0}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
