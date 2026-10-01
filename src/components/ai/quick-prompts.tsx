import { ArrowRight, Bot } from "lucide-react";
import Link from "next/link";

export const EXAMPLE_PROMPTS = [
  "Find emails from clients that need a reply, summarize them, and prepare drafts.",
  "Find all emails from my manager about the project and summarize what I need to do.",
  "Find emails related to the payment issue.",
  "Draft a reply to the latest client email.",
  "Summarize my emails from this week.",
  "Show emails that need a reply.",
];

export function QuickPrompts({ prompts = EXAMPLE_PROMPTS.slice(0, 4) }: { prompts?: string[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {prompts.map((prompt) => (
        <li key={prompt}>
          <Link
            href={`/assistant?prompt=${encodeURIComponent(prompt)}`}
            className="group flex h-full items-start gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
          >
            <Bot className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="flex-1">{prompt}</span>
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
