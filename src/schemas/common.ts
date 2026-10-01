import { z } from "zod";

// Shared vocabularies. Client-safe: no server imports.

export const EMAIL_CATEGORIES = [
  "work",
  "personal",
  "finance",
  "shopping",
  "interview",
  "newsletter",
  "notification",
  "support",
  "important",
  "spam",
  "other",
] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];
export const EmailCategorySchema = z.enum(EMAIL_CATEGORIES);

export const CATEGORY_LABELS: Record<EmailCategory, string> = {
  work: "Work",
  personal: "Personal",
  finance: "Finance",
  shopping: "Shopping",
  interview: "Interview",
  newsletter: "Newsletter",
  notification: "Notification",
  support: "Support",
  important: "Important",
  spam: "Spam",
  other: "Other",
};

export const URGENCY_LEVELS = ["low", "medium", "high"] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];
export const UrgencySchema = z.enum(URGENCY_LEVELS);

export const SUMMARY_LENGTHS = ["short", "normal", "detailed"] as const;
export type SummaryLength = (typeof SUMMARY_LENGTHS)[number];
export const SummaryLengthSchema = z.enum(SUMMARY_LENGTHS);

export const AI_STATUSES = ["pending", "processing", "processed", "failed", "skipped"] as const;
export type AiStatus = (typeof AI_STATUSES)[number];

export const REPLY_STATUSES = ["none", "needs_reply", "drafted", "replied"] as const;
export type ReplyStatus = (typeof REPLY_STATUSES)[number];

export const DRAFT_STATUSES = ["pending_review", "approved", "sending", "sent", "discarded", "failed"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const DRAFT_SOURCES = ["pipeline", "agent", "user"] as const;
export type DraftSource = (typeof DRAFT_SOURCES)[number];

export const CONTACT_RELATIONSHIPS = [
  "manager",
  "colleague",
  "client",
  "recruiter",
  "vendor",
  "friend",
  "family",
  "service",
  "unknown",
] as const;
export type ContactRelationship = (typeof CONTACT_RELATIONSHIPS)[number];
export const ContactRelationshipSchema = z.enum(CONTACT_RELATIONSHIPS);

export const EMAIL_PROVIDERS = ["mock", "gmail"] as const;
export type EmailProviderName = (typeof EMAIL_PROVIDERS)[number];

export const EmailAddressSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
});
export type EmailAddress = z.infer<typeof EmailAddressSchema>;
