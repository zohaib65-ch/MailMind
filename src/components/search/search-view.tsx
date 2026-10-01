"use client";

import { LoaderCircle, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Markdown } from "@/components/common/markdown";
import { RelativeTime } from "@/components/common/relative-time";
import { SearchInput } from "@/components/common/search-input";
import { EmptyState } from "@/components/common/states";
import { EmailCard } from "@/components/inbox/email-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api, ApiError } from "@/lib/api-client";
import { displayName } from "@/lib/utils";
import type { RagAnswerDTO, SearchMode, SearchResultDTO } from "@/types/email";

const MODE_HELP: Record<SearchMode, string> = {
  hybrid: "Meaning + keywords, fused with reciprocal rank fusion",
  semantic: "Vector search: finds emails about the same thing, even with different words",
  keyword: "Classic full-text search on the words you typed",
};

export function SearchView({
  query,
  mode,
  results,
  engine,
  aiConfigured,
  embeddingsProvider,
}: {
  query: string;
  mode: SearchMode;
  results: SearchResultDTO[];
  engine?: "atlas" | "exact";
  aiConfigured: boolean;
  embeddingsProvider: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [answer, setAnswer] = useState<RagAnswerDTO | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const go = (q: string, m: SearchMode = mode) => {
    setAnswer(null);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (m !== "hybrid") params.set("mode", m);
    router.push(`${pathname}?${params.toString()}`);
  };

  async function ask() {
    setAsking(true);
    setAskError(null);
    try {
      setAnswer(await api<RagAnswerDTO>("/api/search/answer", { body: { question: query } }));
    } catch (err) {
      setAskError(err instanceof ApiError ? err.message : "Could not answer");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <SearchInput
          key={query}
          defaultValue={query}
          placeholder="e.g. emails where someone discussed payment problems"
          onSearch={(q) => go(q)}
          autoFocus={!query}
        />
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v) => v && go(query, v as SearchMode)}>
            <ToggleGroupItem value="hybrid">Hybrid</ToggleGroupItem>
            <ToggleGroupItem value="semantic">Semantic</ToggleGroupItem>
            <ToggleGroupItem value="keyword">Keyword</ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            {MODE_HELP[mode]}
            {mode !== "keyword" && ` · embeddings: ${embeddingsProvider}${engine ? ` · ${engine === "atlas" ? "Atlas Vector Search" : "exact cosine (no Atlas index)"}` : ""}`}
          </p>
        </div>
      </div>

      {query && aiConfigured && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Ask your inbox
            </CardTitle>
            <CardDescription>RAG: Claude answers from the most relevant emails only, with citations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!answer && !asking && (
              <Button size="sm" onClick={ask}>
                <Sparkles /> Answer “{query.length > 60 ? `${query.slice(0, 60)}…` : query}”
              </Button>
            )}
            {asking && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Retrieving emails and writing an answer…
              </p>
            )}
            {askError && <p className="text-sm text-destructive">{askError}</p>}
            {answer && (
              <div className="space-y-3">
                <Markdown>{answer.answer}</Markdown>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize">
                    {answer.confidence} confidence
                  </Badge>
                  {answer.sources.map((s) => (
                    <Link key={s.emailId} href={`/emails/${s.emailId}`} className="rounded-md bg-muted px-2 py-0.5 hover:underline">
                      [{s.index}] {displayName(s.from)} — {s.subject} · <RelativeTime iso={s.receivedAt} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!query ? (
        <EmptyState icon={Search} title="Search your email by meaning" description="Try “payment problems”, “delivery deadline” or “interview”." />
      ) : results.length === 0 ? (
        <EmptyState icon={Search} title="No matching emails" description="Try different words, or switch search mode." />
      ) : (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.email.id} className="space-y-1">
              <EmailCard email={r.email} excerpt={r.excerpt} />
              <p className="flex gap-1.5 pl-1 text-[11px] text-muted-foreground">
                matched by {r.matchedBy.join(" + ")} · score {r.score.toFixed(3)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
