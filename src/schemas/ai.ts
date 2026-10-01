import { z } from "zod";
import { EmailCategorySchema, UrgencySchema } from "./common";

/*
 * Structured-output schemas for every AI step.
 *
 * These schemas do two jobs:
 *  1. They are converted to JSON Schema and sent to the model (`output_config.format`), so
 *     the model is constrained to produce this shape. The `.describe()` text is part of the
 *     prompt — it is how the model learns what each field means.
 *  2. Every response is validated with Zod again before it touches the database. Some
 *     constraints (enums, min/max) are only advisory to the model, so this second check is
 *     what actually guarantees the data is valid.
 */

// ─── Classification ───────────────────────────────────────────────────────────

export const ClassificationOutputSchema = z.object({
  category: EmailCategorySchema.describe(
    "The single best category. 'important' is only for critical personal/legal/security matters that fit no other category. 'interview' covers anything about a job interview or hiring process the user is a candidate in.",
  ),
  confidence: z.number().min(0).max(1).describe("How sure you are about the category, from 0 to 1."),
  needsReply: z
    .boolean()
    .describe("True only if a person is waiting for the user to answer. Automated mail, newsletters and FYIs are false."),
  reason: z.string().describe("One short, user-facing sentence explaining the category. No more than 20 words."),
});
export type ClassificationOutput = z.infer<typeof ClassificationOutputSchema>;

/** The combined classification shown in the UI (category + urgency + confidence). */
export type EmailClassification = {
  category: z.infer<typeof EmailCategorySchema>;
  urgency: z.infer<typeof UrgencySchema>;
  confidence: number;
};

// ─── Information extraction ───────────────────────────────────────────────────

const verbatimList = (what: string) =>
  z
    .array(z.string())
    .describe(`${what}. Copy each value exactly as it appears in the email. Use an empty array if there are none.`);

export const ExtractedInformationSchema = z.object({
  people: verbatimList("Names of people mentioned (not email addresses)"),
  companies: verbatimList("Companies or organisations mentioned"),
  dates: verbatimList("Dates or days mentioned, e.g. 'Monday', 'March 3', '2026-10-05'"),
  times: verbatimList("Times of day mentioned, e.g. '10 AM', '14:30'"),
  phoneNumbers: verbatimList("Phone numbers"),
  links: verbatimList("URLs"),
  tasks: z
    .array(z.string())
    .describe(
      "Things the USER is asked or expected to do, each as a short imperative sentence (e.g. 'Confirm availability for Monday 10 AM'). Empty if the user has nothing to do.",
    ),
  deadlines: verbatimList("Deadlines or due dates for the tasks, as written, e.g. 'by Friday', 'before 5pm tomorrow'"),
});
export type ExtractedInformation = z.infer<typeof ExtractedInformationSchema>;

export const EMPTY_EXTRACTION: ExtractedInformation = {
  people: [],
  companies: [],
  dates: [],
  times: [],
  phoneNumbers: [],
  links: [],
  tasks: [],
  deadlines: [],
};

// ─── Summary ──────────────────────────────────────────────────────────────────

export const SummaryOutputSchema = z.object({
  summary: z.string().describe("The summary text, following the requested length."),
});

// ─── Urgency ──────────────────────────────────────────────────────────────────

export const UrgencyOutputSchema = z.object({
  urgency: UrgencySchema.describe("low, medium or high"),
  reasons: z.array(z.string()).describe("1 to 3 short reasons, each under 12 words."),
  respondBy: z
    .string()
    .nullable()
    .describe("ISO date (YYYY-MM-DD) by which the user should act, if the email implies one. Otherwise null."),
});
export type UrgencyOutput = z.infer<typeof UrgencyOutputSchema>;

// ─── Action decision (rule-based, not LLM) ────────────────────────────────────

export const ACTION_TYPES = ["draft_reply", "mark_important", "suggest_archive", "track_tasks"] as const;
export const ActionSchema = z.object({
  type: z.enum(ACTION_TYPES),
  reason: z.string(),
  /** Automatic actions are executed by the pipeline; the rest are only suggestions. */
  automatic: z.boolean(),
});
export const ActionDecisionSchema = z.object({ actions: z.array(ActionSchema) });
export type ActionDecision = z.infer<typeof ActionDecisionSchema>;

// ─── Reply drafting ───────────────────────────────────────────────────────────

export const ReplyDraftOutputSchema = z.object({
  subject: z.string().describe("Reply subject line, normally 'Re: <original subject>'."),
  body: z
    .string()
    .describe(
      "The full plain-text reply, including greeting and sign-off. Use [square-bracket placeholders] for anything you do not know.",
    ),
  notes: z
    .array(z.string())
    .describe("Short notes for the user about assumptions or placeholders they should check. Empty if none."),
});
export type ReplyDraftOutput = z.infer<typeof ReplyDraftOutputSchema>;

// ─── Thread memory ────────────────────────────────────────────────────────────

export const CommitmentSchema = z.object({
  by: z.enum(["user", "contact"]).describe("Who made the commitment: the user, or the other party."),
  text: z.string().describe("What was promised, e.g. 'Deliver the report'."),
  due: z.string().nullable().describe("When it is due, as written (e.g. 'Friday'), or null."),
});

export const ThreadMemoryOutputSchema = z.object({
  summary: z.string().describe("Rolling summary of the whole conversation so far, at most 80 words."),
  facts: z.array(z.string()).describe("Durable facts worth remembering (agreed dates, prices, names). At most 8."),
  commitments: z.array(CommitmentSchema).describe("Promises made by either side that are still relevant. At most 6."),
  openQuestions: z.array(z.string()).describe("Questions that are still unanswered. At most 4."),
});
export type ThreadMemoryOutput = z.infer<typeof ThreadMemoryOutputSchema>;

// ─── RAG answer ───────────────────────────────────────────────────────────────

export const RagAnswerOutputSchema = z.object({
  answer: z
    .string()
    .describe("Answer in markdown. Cite sources inline as [1], [2] using the source numbers given. Say so plainly if the sources do not contain the answer."),
  citations: z.array(z.number().int()).describe("The source numbers you actually used."),
  confidence: z.enum(["high", "medium", "low"]).describe("How well the sources support the answer."),
});
export type RagAnswerOutput = z.infer<typeof RagAnswerOutputSchema>;
