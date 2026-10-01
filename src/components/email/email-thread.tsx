"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ThreadMessageDTO } from "@/types/email";
import { EmailMessage } from "./email-message";

/** The conversation, oldest first. Older messages start collapsed so the current one stands out. */
export function EmailThread({ messages, currentId }: { messages: ThreadMessageDTO[]; currentId: string }) {
  const [expanded, setExpanded] = useState(false);
  const currentIndex = messages.findIndex((m) => m.id === currentId);
  const older = messages.slice(0, Math.max(0, currentIndex));
  const rest = messages.slice(Math.max(0, currentIndex));
  const hidden = !expanded && older.length > 2 ? older.length - 1 : 0;

  return (
    <div className="space-y-3">
      {hidden > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setExpanded(true)}>
          Show {hidden} earlier message{hidden === 1 ? "" : "s"}
        </Button>
      )}
      {older.slice(hidden).map((m) => (
        <EmailMessage key={m.id} message={m} collapsed={!expanded} />
      ))}
      {rest.map((m) => (
        <EmailMessage key={m.id} message={m} highlighted={m.id === currentId && messages.length > 1} />
      ))}
    </div>
  );
}
