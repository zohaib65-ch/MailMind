# 1. Overview

## What MailMind does

For every email that arrives in your Gmail, MailMind:

1. **Parses** it: headers, plain-text body (HTML converted to text), threading information.
2. **Classifies** it into one of eleven categories: Work, Personal, Finance, Shopping, Interview, Newsletter, Notification, Support, Important, Spam, Other.
3. **Extracts** facts that are actually in the email: people, companies, dates, times, phone numbers, links, your tasks and deadlines. Anything the model can't point to in the text is dropped.
4. **Summarises** it (short, normal or detailed).
5. **Rates urgency** as low, medium or high, with reasons.
6. **Decides actions**: draft a reply, mark as important, track tasks, or suggest archiving.
7. **Drafts a reply** when one is needed, using the thread's history.
8. **Updates conversation memory**, a compact record of what was agreed in the thread ("Sam promised delivery on Friday").

## The core rule: a human approves every email that is sent

```text
AI creates a draft ──▶ you review ──▶ you edit (optional) ──▶ you click Send ──▶ Gmail sends
```

The AI can create drafts. It cannot approve them. Sending checks the draft's status in the database, so even a misbehaving model can't send mail you haven't approved. See [Security](08-security.md).

## What you'll learn from the code

The project is built to demonstrate a practical, production-style AI application:

| Concept | Where it lives |
|---|---|
| LLM calls | `src/lib/langchain/model.ts`: one factory, a model and thinking level per task |
| Prompt templates | `src/lib/langchain/prompts/*`: one `ChatPromptTemplate` per step |
| Structured output | `src/schemas/ai.ts` (Zod) + `src/lib/langchain/structured.ts` |
| Workflows | `src/services/ai/pipeline.ts`: a LangGraph `StateGraph` with parallel branches |
| Memory | Thread memory (pipeline): a rolling summary, facts and commitments per thread |
| Human-in-the-loop | The draft state machine: `sendApprovedDraft` refuses any draft you haven't approved |

## Tech stack

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (App Router, Server Components, Route Handlers, `proxy.ts`) |
| Language | TypeScript (strict) |
| UI | Tailwind CSS v4, shadcn/ui (Radix), Lucide icons, Sonner toasts |
| Database | MongoDB Atlas via Mongoose 9 |
| LLM | Google Gemini via `@langchain/google` (`ChatGoogle`) |
| AI framework | LangChain JS v1, LangGraph |
| Validation | Zod 4 |
| Email | Gmail API (`@googleapis/gmail`) with Google OAuth (`google-auth-library`) |
| Caching / rate limits / locks | Redis via `ioredis` (optional; in-process fallback) |

## Pages

| Page | Path | What it shows |
|---|---|---|
| Dashboard | `/dashboard` | Totals (all, unread, important, needs reply, AI processed), emails needing attention, urgency and category breakdowns, drafts waiting for review |
| Inbox | `/inbox` | Email list with sender, subject, category and urgency badges, AI summary, date and status; views, filters and keyword search (the header search box opens `/inbox?q=…`) |
| Email detail | `/emails/[id]` | The thread, AI summary (three lengths), extracted information, classification, actions taken, conversation memory, and the suggested reply editor |
| Drafts | `/drafts` | All drafts waiting for review |
| Contacts | `/contacts` | People you email, with a relationship label (client, manager…) you can set to keep them organised |
| Settings | `/settings` | Connected Gmail account, AI preferences (reply tone, signature, summary length, auto-draft, auto-mark important) |
