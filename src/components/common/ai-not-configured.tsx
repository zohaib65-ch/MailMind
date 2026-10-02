import { KeyRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AiNotConfiguredNotice() {
  return (
    <Alert>
      <KeyRound />
      <AlertTitle>AI features are switched off</AlertTitle>
      <AlertDescription>
        Add <code className="rounded bg-muted px-1">GEMINI_API_KEY</code> to your <code className="rounded bg-muted px-1">.env</code> and
        restart to enable classification, summaries and reply drafts. Keyword search still works.
      </AlertDescription>
    </Alert>
  );
}
