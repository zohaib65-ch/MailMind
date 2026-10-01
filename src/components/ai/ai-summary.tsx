"use client";

import { LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api, ApiError } from "@/lib/api-client";
import type { SummaryLength } from "@/schemas/common";

/** The AI summary with a Short / Normal / Detailed switch. Other lengths are generated on demand. */
export function AiSummary({
  emailId,
  initial,
  defaultLength = "normal",
  aiConfigured,
}: {
  emailId: string;
  initial: Partial<Record<SummaryLength, string>>;
  defaultLength?: SummaryLength;
  aiConfigured: boolean;
}) {
  const [length, setLength] = useState<SummaryLength>(initial[defaultLength] ? defaultLength : "normal");
  const [summaries, setSummaries] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function load(next: SummaryLength, regenerate = false) {
    setLength(next);
    if (summaries[next] && !regenerate) return;
    if (!aiConfigured) return;
    setLoading(true);
    try {
      const { summary } = await api<{ summary: string }>(`/api/emails/${emailId}/summary`, { body: { length: next, regenerate } });
      setSummaries((s) => ({ ...s, [next]: summary }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not summarise");
    } finally {
      setLoading(false);
    }
  }

  const text = summaries[length];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> AI summary
        </CardTitle>
        <CardAction>
          <Button variant="ghost" size="icon-sm" aria-label="Regenerate summary" disabled={!aiConfigured || loading} onClick={() => load(length, true)}>
            <RefreshCw />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={length}
          onValueChange={(v) => v && load(v as SummaryLength)}
          aria-label="Summary length"
        >
          <ToggleGroupItem value="short">Short</ToggleGroupItem>
          <ToggleGroupItem value="normal">Normal</ToggleGroupItem>
          <ToggleGroupItem value="detailed">Detailed</ToggleGroupItem>
        </ToggleGroup>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Summarising…
          </p>
        ) : text ? (
          <p className="whitespace-pre-line text-sm leading-relaxed">{text}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {aiConfigured ? "No summary yet — run the AI analysis or pick a length." : "AI is not configured."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
