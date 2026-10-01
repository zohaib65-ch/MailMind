import { Building2, Calendar, CalendarClock, Clock, Link2, ListChecks, Phone, UserRound, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExtractedInformation } from "@/schemas/ai";

const FIELDS: { key: keyof ExtractedInformation; label: string; icon: LucideIcon }[] = [
  { key: "tasks", label: "Your tasks", icon: ListChecks },
  { key: "deadlines", label: "Deadlines", icon: CalendarClock },
  { key: "dates", label: "Dates", icon: Calendar },
  { key: "times", label: "Times", icon: Clock },
  { key: "people", label: "People", icon: UserRound },
  { key: "companies", label: "Companies", icon: Building2 },
  { key: "phoneNumbers", label: "Phone numbers", icon: Phone },
  { key: "links", label: "Links", icon: Link2 },
];

/** Structured extraction, already verified against the email text by the grounding step. */
export function ExtractedInfo({ extracted }: { extracted?: ExtractedInformation }) {
  if (!extracted) return null;
  const present = FIELDS.filter((f) => extracted[f.key].length > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Extracted information</CardTitle>
        <CardDescription>Only values found in the email itself</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {present.length === 0 && <p className="text-sm text-muted-foreground">Nothing to extract.</p>}
        {present.map(({ key, label, icon: Icon }) => (
          <div key={key} className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Icon className="size-3.5" /> {label}
            </p>
            {key === "tasks" ? (
              <ul className="space-y-1">
                {extracted.tasks.map((t) => (
                  <li key={t} className="flex gap-2 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {t}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {extracted[key].map((value) =>
                  key === "links" ? (
                    <a
                      key={value}
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="max-w-full truncate rounded-md bg-muted px-2 py-0.5 text-xs text-primary hover:underline"
                    >
                      {value.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span key={value} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                      {value}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
