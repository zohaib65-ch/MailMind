import type { ExtractedInformation } from "@/schemas/ai";

/*
 * Anti-hallucination for extraction ("do not invent information").
 *
 * The LLM is asked to copy values verbatim, but models can still paraphrase or invent. So
 * after extraction we *check* each value against the email text and drop anything that is
 * not actually there. Deterministic regexes also find links and phone numbers the model
 * may have missed. Pure functions — easy to unit test.
 */

const STOPWORDS = new Set(["the", "a", "an", "at", "on", "by", "in", "of", "to", "for", "and", "or", "before", "after", "until", "end", "day"]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}@.:/'+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .map((t) => t.replace(/^[.:'-]+|[.:'-]+$/g, ""))
    .filter((t) => t && !STOPWORDS.has(t));
}

const digits = (text: string) => text.replace(/\D/g, "");

/** Exact (case/space-insensitive) substring match. Used for names and companies. */
export function appearsVerbatim(value: string, source: string): boolean {
  const v = normalize(value);
  return v.length > 0 && normalize(source).includes(v);
}

/**
 * Every meaningful token of the value appears in the source. Tolerates small rewordings
 * like "Friday 5 PM" for "by Friday at 5 PM" while still rejecting invented values.
 */
export function tokensAppear(value: string, source: string): boolean {
  const valueTokens = tokens(value);
  if (!valueTokens.length) return false;
  const sourceTokens = new Set(tokens(source));
  const sourceNorm = normalize(source);
  return valueTokens.every((t) => sourceTokens.has(t) || sourceNorm.includes(t));
}

export function phoneAppears(value: string, source: string): boolean {
  const d = digits(value);
  return d.length >= 7 && digits(source).includes(d);
}

export function linkAppears(value: string, source: string): boolean {
  const v = value.trim().replace(/[).,;]+$/, "");
  return v.length > 0 && source.includes(v);
}

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g;

export function regexExtract(source: string): { links: string[]; phoneNumbers: string[] } {
  const links = [...source.matchAll(URL_RE)].map((m) => m[0].replace(/[).,;:]+$/, ""));
  const phoneNumbers = [...source.matchAll(PHONE_RE)].map((m) => m[0].trim()).filter((p) => digits(p).length >= 7);
  return { links, phoneNumbers };
}

function unique(values: string[], keyFn: (v: string) => string = (v) => v.toLowerCase()): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = keyFn(v.trim());
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type GroundingReport = { extracted: ExtractedInformation; dropped: { field: string; value: string }[] };

export function groundExtraction(extracted: ExtractedInformation, source: string): GroundingReport {
  const dropped: GroundingReport["dropped"] = [];
  const keep = (field: string, values: string[], check: (v: string) => boolean) =>
    values.filter((value) => {
      const ok = check(value);
      if (!ok) dropped.push({ field, value });
      return ok;
    });

  const regex = regexExtract(source);
  const result: ExtractedInformation = {
    people: unique(keep("people", extracted.people, (v) => appearsVerbatim(v, source))),
    companies: unique(keep("companies", extracted.companies, (v) => appearsVerbatim(v, source))),
    dates: unique(keep("dates", extracted.dates, (v) => tokensAppear(v, source))),
    times: unique(keep("times", extracted.times, (v) => tokensAppear(v, source))),
    deadlines: unique(keep("deadlines", extracted.deadlines, (v) => tokensAppear(v, source))),
    // Compare the last 10 digits so "+1 (415) 555-0142" and "415-555-0142" count as one number.
    phoneNumbers: unique(
      [...keep("phoneNumbers", extracted.phoneNumbers, (v) => phoneAppears(v, source)), ...regex.phoneNumbers],
      (v) => digits(v).slice(-10),
    ),
    links: unique([...keep("links", extracted.links, (v) => linkAppears(v, source)), ...regex.links], (v) => v),
    // Tasks are paraphrased by design, so they cannot be checked verbatim; we only cap them.
    tasks: unique(extracted.tasks.map((t) => t.trim()).filter(Boolean)).slice(0, 10),
  };
  return { extracted: result, dropped };
}
