import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CATEGORY_LABELS, type EmailCategory } from "@/schemas/common";

/**
 * Horizontal bar list of emails per category. One series → one hue for every bar (the
 * category names carry identity, not colour). Labels and values use text colours; each
 * bar links to the filtered inbox and shows its share on hover/focus.
 */
export function CategoryBreakdown({ data }: { data: { category: EmailCategory; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((n, d) => n + d.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emails by category</CardTitle>
        <CardDescription>Assigned by the AI classifier</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Categories appear once emails have been analysed.</p>
        ) : (
          <ul className="space-y-1">
            {data.map((d) => (
              <li key={d.category}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/inbox?view=all&category=${d.category}`}
                      className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="truncate text-muted-foreground">{CATEGORY_LABELS[d.category]}</span>
                      <span className="h-2.5" aria-hidden>
                        <span
                          className="block h-full rounded-r-[4px] bg-primary transition-opacity group-hover:opacity-90"
                          style={{ width: `${Math.max(2, (d.count / max) * 100)}%` }}
                        />
                      </span>
                      <span className="text-right font-medium tabular-nums">{d.count}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <span className="font-semibold">{d.count}</span> {CATEGORY_LABELS[d.category]} · {Math.round((d.count / total) * 100)}% of
                    analysed email
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
