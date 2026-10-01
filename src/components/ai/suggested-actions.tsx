import { Archive, FilePenLine, ListChecks, Star, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionDecision } from "@/schemas/ai";

const ICONS: Record<ActionDecision["actions"][number]["type"], { icon: LucideIcon; label: string }> = {
  draft_reply: { icon: FilePenLine, label: "Draft a reply" },
  mark_important: { icon: Star, label: "Mark as important" },
  suggest_archive: { icon: Archive, label: "Archive" },
  track_tasks: { icon: ListChecks, label: "Track tasks" },
};

/** The rule-based Action Decision step's output: what was done automatically vs only suggested. */
export function SuggestedActions({ actions }: { actions: ActionDecision["actions"] }) {
  if (!actions.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>Decided by MailMind&apos;s action rules</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {actions.map((a) => {
            const meta = ICONS[a.type];
            return (
              <li key={a.type} className="flex items-start gap-2 text-sm">
                <meta.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{a.reason}</p>
                </div>
                <span className="text-xs text-muted-foreground">{a.automatic ? "Done automatically" : "Suggested"}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
