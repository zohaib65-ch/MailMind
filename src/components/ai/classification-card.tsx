import { CalendarClock } from "lucide-react";
import { CategoryBadge, UrgencyBadge } from "@/components/common/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmailAiDetailDTO } from "@/types/email";

export function ClassificationCard({ ai }: { ai: EmailAiDetailDTO }) {
  if (!ai.category && !ai.urgency) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Classification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={ai.category} />
          <UrgencyBadge urgency={ai.urgency} />
          {ai.confidence !== undefined && (
            <span className="text-xs text-muted-foreground">{Math.round(ai.confidence * 100)}% confident</span>
          )}
        </div>
        {ai.categoryReason && <p className="text-muted-foreground">{ai.categoryReason}</p>}
        {ai.urgencyReasons.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            {ai.urgencyReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {ai.respondBy && (
          <p className="flex items-center gap-1.5 text-sm">
            <CalendarClock className="size-4 text-muted-foreground" /> Act by <span className="font-medium">{ai.respondBy}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
