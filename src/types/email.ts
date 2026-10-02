// Plain JSON shapes sent from the server to the browser. Dates are ISO strings and ids
// are hex strings, so these are safe to pass from Server to Client Components.
import type { ActionDecision, ExtractedInformation } from "@/schemas/ai";
import type {
  AiStatus,
  ContactRelationship,
  DraftSource,
  DraftStatus,
  EmailAddress,
  EmailCategory,
  ReplyStatus,
  SummaryLength,
  Urgency,
} from "@/schemas/common";

export type EmailAiSummaryDTO = {
  status: AiStatus;
  category?: EmailCategory;
  urgency?: Urgency;
  confidence?: number;
  needsReply: boolean;
  summary?: string;
};

export type EmailListItemDTO = {
  id: string;
  threadId: string;
  direction: "inbound" | "outbound";
  from: EmailAddress;
  subject: string;
  snippet: string;
  receivedAt: string;
  labels: string[];
  isRead: boolean;
  isImportant: boolean;
  isArchived: boolean;
  replyStatus: ReplyStatus;
  ai: EmailAiSummaryDTO;
};

export type EmailAiDetailDTO = EmailAiSummaryDTO & {
  error?: string;
  processedAt?: string;
  categoryReason?: string;
  urgencyReasons: string[];
  respondBy?: string | null;
  summaryShort?: string;
  summaryDetailed?: string;
  extracted?: ExtractedInformation;
  actions: ActionDecision["actions"];
  model?: string;
};

export type ThreadMessageDTO = {
  id: string;
  direction: "inbound" | "outbound";
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  bodyText: string;
  receivedAt: string;
};

export type ThreadMemoryDTO = {
  summary: string;
  facts: string[];
  commitments: { by: "user" | "contact"; text: string; due: string | null }[];
  openQuestions: string[];
  updatedAt: string;
};

export type EmailDetailDTO = Omit<EmailListItemDTO, "ai"> & {
  to: EmailAddress[];
  cc: EmailAddress[];
  bodyText: string;
  ai: EmailAiDetailDTO;
  thread: {
    id: string;
    subject: string;
    messageCount: number;
    messages: ThreadMessageDTO[];
    memory?: ThreadMemoryDTO;
  };
};

export type DraftDTO = {
  id: string;
  emailId?: string;
  threadId?: string;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  body: string;
  originalBody?: string;
  status: DraftStatus;
  source: DraftSource;
  notes: string[];
  model?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  /** Short context about the email being replied to, for draft lists. */
  replyTo?: { from: EmailAddress; subject: string; receivedAt: string };
};

export type ContactDTO = {
  id: string;
  email: string;
  name?: string;
  company?: string;
  relationship: ContactRelationship;
  emailCount: number;
  lastEmailAt?: string;
};

export type DashboardStatsDTO = {
  total: number;
  unread: number;
  important: number;
  needsReply: number;
  aiProcessed: number;
  aiPending: number;
  aiFailed: number;
  pendingDrafts: number;
  byCategory: { category: EmailCategory; count: number }[];
  byUrgency: { urgency: Urgency; count: number }[];
};

export type UserSettingsDTO = {
  replyTone: string;
  signature?: string;
  summaryLength: SummaryLength;
  autoDraftReplies: boolean;
  autoMarkImportant: boolean;
};
