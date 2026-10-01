"use client";

import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg pt-10">
      <ErrorState
        message={error.digest ? `Something failed on the server (ref ${error.digest}).` : error.message}
        action={
          <Button size="sm" variant="outline" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
