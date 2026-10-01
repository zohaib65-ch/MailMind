import { convert } from "html-to-text";
export { formatAddressHeader, parseAddressList } from "./address";

/**
 * Text helpers for email bodies. Emails are rendered as plain text in the UI (never as
 * raw HTML), which removes a whole class of XSS problems from untrusted email content.
 */

export function htmlToText(html: string): string {
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { hideLinkHrefIfSameAsText: true, ignoreHref: false } },
      { selector: "style", format: "skip" },
      { selector: "script", format: "skip" },
    ],
  }).trim();
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function makeSnippet(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

const QUOTE_HEADERS = [
  /^On .{3,200}wrote:\s*$/m, // Gmail / Apple Mail
  /^-{2,}\s*Original Message\s*-{2,}/im, // Outlook
  /^From:\s.+\n(?:Sent|Date):\s.+/m, // Outlook header block
  /^_{5,}\s*$/m,
];

/**
 * Removes quoted previous messages and the signature delimiter block, leaving only what
 * the sender actually wrote in this message. Previous messages in the thread are given to
 * the AI separately (as thread memory), so sending them again would only waste tokens.
 */
export function stripQuotedReply(text: string): string {
  let body = text.replace(/\r\n?/g, "\n");
  for (const header of QUOTE_HEADERS) {
    const match = header.exec(body);
    if (match && match.index > 0) body = body.slice(0, match.index);
  }
  body = body
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");
  const sigIndex = body.search(/^-- ?$/m);
  if (sigIndex > 0) body = body.slice(0, sigIndex);
  return normalizeWhitespace(body);
}

/**
 * Body text prepared for an LLM prompt: quoted replies stripped, then length-capped.
 * The cap is explicit (with a marker) rather than silent, so the model knows text is missing.
 */
/** Tag names MailMind uses to fence untrusted content inside prompts. */
const PROMPT_TAGS = /<(\/?)(email|thread|memory|source|sources|user_notes|body)\b/gi;

/**
 * Stops email text from closing (or opening) the tags our prompts use to fence it, e.g. a
 * body containing "</email>" followed by fake instructions. The text stays readable.
 */
export function neutralizePromptTags(text: string): string {
  return text.replace(PROMPT_TAGS, "‹$1$2");
}

export function bodyForAi(text: string, maxChars = 12_000): string {
  const clean = neutralizePromptTags(stripQuotedReply(text) || normalizeWhitespace(text));
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars)}\n\n[... ${clean.length - maxChars} more characters omitted ...]`;
}

export function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}
