import { z } from "zod";
import {
  ContactRelationshipSchema,
  EmailAddressSchema,
  EmailCategorySchema,
  SummaryLengthSchema,
  UrgencySchema,
} from "./common";

// Request validation for every API route. Anything not described here is rejected.

const INBOX_VIEWS = ["inbox", "unread", "needs_reply", "important", "archived", "sent", "all"] as const;

export const InboxQuerySchema = z.object({
  view: z.enum(INBOX_VIEWS).optional(),
  category: EmailCategorySchema.optional(),
  urgency: UrgencySchema.optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).max(1_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const EmailPatchSchema = z
  .object({
    isRead: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    isImportant: z.boolean().optional(),
    replyHandled: z.literal(true).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const ProcessEmailSchema = z.object({ force: z.boolean().optional() });

export const SummaryRequestSchema = z.object({
  length: SummaryLengthSchema,
  regenerate: z.boolean().optional(),
});

export const GenerateReplySchema = z.object({ instructions: z.string().max(1_000).optional() });

const draftFields = {
  to: z.array(EmailAddressSchema).min(1).max(20).optional(),
  cc: z.array(EmailAddressSchema).max(20).optional(),
  subject: z.string().min(1).max(500).optional(),
  body: z.string().min(1).max(50_000).optional(),
};

export const DraftEditSchema = z.object(draftFields);

export const CreateDraftSchema = z.object({
  emailId: z.string().optional(),
  to: z.array(EmailAddressSchema).max(20).optional(),
  cc: z.array(EmailAddressSchema).max(20).optional(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(50_000),
});

/** Sending requires an explicit `confirm: true` — the user's approval, in the request. */
export const SendDraftSchema = z.object({ ...draftFields, confirm: z.literal(true) });

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(300),
  mode: z.enum(["keyword", "semantic", "hybrid"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const AskSchema = z.object({ question: z.string().min(3).max(500) });

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4_000),
  conversationId: z.string().optional(),
});

export const ResumeRequestSchema = z.object({
  conversationId: z.string(),
  decision: z.enum(["approve", "reject"]),
  edits: DraftEditSchema.optional(),
  reason: z.string().max(500).optional(),
});

export const SettingsPatchSchema = z.object({
  replyTone: z.string().min(2).max(200).optional(),
  signature: z.string().max(500).optional(),
  summaryLength: SummaryLengthSchema.optional(),
  autoDraftReplies: z.boolean().optional(),
  autoMarkImportant: z.boolean().optional(),
});

export const ContactQuerySchema = z.object({
  q: z.string().max(100).optional(),
  relationship: ContactRelationshipSchema.optional(),
});

export const ContactPatchSchema = z.object({
  relationship: ContactRelationshipSchema.optional(),
  company: z.string().max(100).optional(),
  name: z.string().max(100).optional(),
});

export const ActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  emailId: z.string().optional(),
  conversationId: z.string().optional(),
});
