import { format, formatDistanceToNowStrict, isThisYear, isToday } from "date-fns";

/** Compact inbox-style date: "3:42 PM" today, "Sep 28" this year, otherwise "Sep 28, 2025". */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return format(date, "h:mm a");
  return isThisYear(date) ? format(date, "MMM d") : format(date, "MMM d, yyyy");
}

export function RelativeTime({ iso, mode = "short", className }: { iso: string; mode?: "short" | "relative" | "full"; className?: string }) {
  const date = new Date(iso);
  const text =
    mode === "relative"
      ? formatDistanceToNowStrict(date, { addSuffix: true })
      : mode === "full"
        ? format(date, "EEE, MMM d, yyyy 'at' h:mm a")
        : shortDate(iso);
  // Server and browser can disagree by a few seconds (or a time zone); that's expected.
  return (
    <time dateTime={iso} title={format(date, "PPpp")} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
