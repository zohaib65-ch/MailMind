"use client";

import { ArrowUp, Square } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ChatComposer({
  onSend,
  onStop,
  running,
  disabled,
  initialValue = "",
  placeholder = "Ask MailMind to find, summarise or reply to emails…",
}: {
  onSend: (message: string) => void;
  onStop: () => void;
  running: boolean;
  disabled?: boolean;
  initialValue?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const submit = () => {
    const message = value.trim();
    if (!message || running || disabled) return;
    onSend(message);
    setValue("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  return (
    <div className="relative rounded-2xl border bg-card shadow-xs focus-within:ring-3 focus-within:ring-ring/30">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Message the assistant"
        className="min-h-14 resize-none border-0 bg-transparent pr-14 shadow-none focus-visible:ring-0 dark:bg-transparent"
        maxLength={4000}
      />
      <div className="absolute bottom-2 right-2">
        {running ? (
          <Button size="icon-sm" variant="secondary" onClick={onStop} aria-label="Stop">
            <Square className="fill-current" />
          </Button>
        ) : (
          <Button size="icon-sm" onClick={submit} disabled={!value.trim() || disabled} aria-label="Send message">
            <ArrowUp />
          </Button>
        )}
      </div>
    </div>
  );
}
