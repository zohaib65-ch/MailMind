import { BrainCircuit } from "lucide-react";
import { RelativeTime } from "@/components/common/relative-time";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ThreadMemoryDTO } from "@/types/email";

/** What MailMind remembers about this conversation — the context used when drafting replies. */
export function ThreadMemoryCard({ memory }: { memory?: ThreadMemoryDTO }) {
  if (!memory) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BrainCircuit className="size-4 text-primary" /> Conversation memory
        </CardTitle>
        <CardDescription>
          Used when drafting replies · updated <RelativeTime iso={memory.updatedAt} mode="relative" />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{memory.summary}</p>
        {memory.commitments.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Commitments</p>
            <ul className="space-y-1">
              {memory.commitments.map((c) => (
                <li key={`${c.by}-${c.text}`} className="text-sm">
                  <span className="font-medium">{c.by === "user" ? "You" : "They"}</span> — {c.text}
                  {c.due && <span className="text-muted-foreground"> (by {c.due})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {memory.facts.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Facts</p>
            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
              {memory.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {memory.openQuestions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Open questions</p>
            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
              {memory.openQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
