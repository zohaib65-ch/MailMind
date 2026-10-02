// Client-safe (no dependencies): used by the message view and by the server-side text helpers.

const QUOTE_HEADERS = [
  // Gmail / Apple Mail. Plain-text parts are wrapped at ~76 characters, so "wrote:" often
  // lands on the next line: "On Fri, Oct 2, 2026 at 10:10 AM Sam <sam@x.com>\nwrote:".
  /^On\s[^\n]{3,200}(?:\n[^\n]{0,200}){0,2}?wrote:[ \t]*$/m,
  /^-{2,}\s*Original Message\s*-{2,}/im, // Outlook
  /^From:\s.+\n(?:Sent|Date):\s.+/m, // Outlook header block
  /^_{5,}\s*$/m,
];

export const isQuoteLine = (line: string) => line.trimStart().startsWith(">");

/** Index where the quoted earlier messages begin, or -1 if there are none. */
function quoteStart(text: string): number {
  let start = -1;
  for (const header of QUOTE_HEADERS) {
    const match = header.exec(text);
    if (match && match.index > 0 && (start < 0 || match.index < start)) start = match.index;
  }
  if (start >= 0) return start;

  // No header line: a trailing block of "> " lines is still quoted history.
  const lines = text.split("\n");
  let i = lines.length;
  while (i > 0 && (isQuoteLine(lines[i - 1]!) || !lines[i - 1]!.trim())) i--;
  if (i === 0 || i === lines.length) return -1;
  return lines.slice(0, i).join("\n").length + 1;
}

/**
 * Splits a body into what the sender wrote in this message and the quoted earlier messages
 * below it, so the UI can collapse the quote (the thread already shows those messages).
 */
export function splitQuotedReply(text: string): { body: string; quoted?: string } {
  const normalized = text.replace(/\r\n?/g, "\n");
  const start = quoteStart(normalized);
  if (start < 0) return { body: normalized };
  const body = normalized.slice(0, start).trimEnd();
  if (!body) return { body: normalized };
  return { body, quoted: normalized.slice(start).trim() };
}

/** Removes one level of "> " quoting, for showing a quote as a block instead of raw text. */
export function unquote(text: string): string {
  return text.replace(/^[ \t]*> ?/gm, "");
}
