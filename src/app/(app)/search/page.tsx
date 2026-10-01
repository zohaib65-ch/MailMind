import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SearchView } from "@/components/search/search-view";
import { isAiConfigured } from "@/lib/utils/env";
import { getEmbeddingsInfo } from "@/services/embeddings/providers";
import { requireUser } from "@/services/auth/dal";
import { searchEmails } from "@/services/search/search.service";
import type { SearchMode } from "@/types/email";

export const metadata: Metadata = { title: "Search" };

const MODES: SearchMode[] = ["hybrid", "semantic", "keyword"];

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const user = await requireUser();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 300).trim() : "";
  const mode = MODES.includes(params.mode as SearchMode) ? (params.mode as SearchMode) : "hybrid";
  const { results, engine } = query ? await searchEmails(user.id, { query, mode }) : { results: [], engine: undefined };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Semantic search" description="Find emails by what they're about, not just the words they use." />
      <SearchView
        query={query}
        mode={mode}
        results={results}
        engine={engine}
        aiConfigured={isAiConfigured()}
        embeddingsProvider={`Gemini ${getEmbeddingsInfo().model}`}
      />
    </div>
  );
}
