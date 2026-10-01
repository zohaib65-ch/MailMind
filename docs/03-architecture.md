# 3. Architecture

## Layers

Each layer talks only to the one below it:

```text
UI            src/app/(app)/*, src/components/*       React Server + Client Components
  │  fetch / SSE (same origin only)
API           src/app/api/**/route.ts                 auth, CSRF check, rate limit, Zod validation
  │  function calls
Services      src/services/*                          business logic — the only place rules live
  │
Integrations  src/lib/langchain, src/lib/db,          Gemini (LangChain), MongoDB (Mongoose),
              src/services/email/providers            Gmail API, Redis
```

- **Pages are Server Components.** They call services directly (no HTTP hop) after `requireUser()` checks the session.
- **Client Components** (forms, chat, buttons) call the API routes with `src/lib/api-client.ts`. The browser only ever talks to MailMind's own `/api/*` routes, never to Gemini or Gmail, so no key or token reaches the browser.
- **Services** hold the rules ("one pending draft per email", "only approved drafts can be sent"). Routes and pages stay thin.
- **The AI never touches a provider directly.** Agent tools and pipeline steps call the same services the UI uses, so every safety rule applies to the AI too.

## Folder structure

```text
src/
├── app/
│   ├── (app)/              Signed-in pages: dashboard, inbox, emails/[id], assistant, drafts,
│   │                       search, contacts, activity, settings (+ shared layout, loading, error)
│   ├── (auth)/login/       Sign-in page
│   ├── api/                Route handlers (see API reference)
│   ├── layout.tsx          Root layout: fonts, theme, toaster
│   └── page.tsx            Redirects to /dashboard
├── proxy.ts                Next 16 "proxy" (formerly middleware): optimistic auth redirect
├── components/
│   ├── ui/                 shadcn/ui primitives (generated)
│   ├── layout/             Sidebar, header, MailSync (auto-sync), AI status indicator, user menu
│   ├── inbox/              EmailList, EmailCard, filters, pagination, toolbar
│   ├── email/              EmailViewer, EmailThread, EmailMessage, ExtractedInfo, ReplyPanel, actions
│   ├── ai/                 AiSummary, AiDraft, ApprovalCard, AgentActivity, ToolExecution,
│   │                       PipelineProgress, ChatMessage, AssistantView, ThreadMemoryCard…
│   ├── dashboard/          Category breakdown, urgency summary
│   ├── search/, contacts/, settings/, auth/
│   └── common/             CategoryBadge, UrgencyBadge, StatCard, SearchInput, EmptyState,
│                           LoadingState, ErrorState, Markdown, RelativeTime, Logo
├── hooks/                  useAgentChat (SSE chat state), usePipelineRun (live pipeline steps)
├── lib/
│   ├── db/                 Mongoose connection + models/
│   ├── langchain/          model.ts (Gemini factory), structured.ts, prompts/
│   ├── vector/             Atlas Vector Search + exact-cosine fallback
│   ├── utils/              env, errors, logger, http (route wrapper + SSE), rate-limit, cache/locks,
│   │                       redis, crypto, email-text, address, stream
│   └── api-client.ts       Browser-side fetch + SSE reader
├── schemas/                Zod: ai.ts (LLM outputs), api.ts (request bodies), common.ts (enums)
├── services/
│   ├── ai/                 pipeline.ts (LangGraph), steps/, processing, reply, summary, activity
│   ├── agent/              agent.ts, run.ts (streaming + approval), prompt.ts, tools/, conversations
│   ├── email/              sync, parser, email, draft, contact, account services; providers/gmail.ts; mime.ts
│   ├── embeddings/         Gemini embeddings + indexer (chunking)
│   ├── search/             keyword / semantic / hybrid search, RRF, RAG
│   ├── auth/               Google OAuth, sessions, data-access layer (requireUser)
│   ├── dashboard/, user/   Stats; user settings and memories
│   └── jobs.ts             Post-sync background work (embeddings → AI pipeline)
└── types/                  DTOs shared by server and client (email.ts, agent.ts)
scripts/                    CLI: db-indexes.ts, process-emails.ts
docs/                       This documentation
```

`server-only` is imported by every module that touches secrets or the database. Importing one of them from a Client Component fails the build.

## Request flows

### A new email arrives

```text
Browser tab (MailSync, every 60s while visible)
  └─▶ POST /api/sync {background:true}
        └─▶ syncUser → syncAccount (lock per account)
              └─▶ Gmail History API: changes since the stored historyId
                    ├─ new messages  → parse → storeParsedEmail (thread, email, contacts)
                    ├─ label changes → update read / starred / archived
                    └─ deletions     → remove the email and its embeddings
        ◀── { created, updated, errors }      (the UI shows a toast and refreshes)
        └─▶ after(): runPostSyncJobs(emailIds)
              ├─ indexPendingEmails      → Gemini embeddings → email_embeddings
              └─ processPendingEmails    → AI pipeline per email (newest first, capped)
```

### Opening an email

`/emails/[id]` (Server Component) → `requireUser()` → `getEmailDetail(userId, id)`. This loads the email, its thread and the latest draft, all scoped by `userId`. Unknown or foreign ids return 404. If the email hasn't been analysed, **Analyse with AI** calls `POST /api/emails/[id]/process`, which streams each pipeline step over Server-Sent Events.

### Asking the assistant

`POST /api/assistant/chat` → `streamAgentTurn()` → LangChain agent (Gemini + tools, MongoDB checkpointer). Tool activity, answer tokens, draft cards and approval requests stream back as SSE events. The run finishes server-side even if the browser disconnects. See [Agent, tools and human approval](05-agent-and-tools.md).

## Design decisions

| Decision | Why |
|---|---|
| **MongoDB + Mongoose** (not SQL) | Email is document-shaped: nested AI results, address lists, labels. Atlas also gives vector search in the same database. |
| **LangGraph for the pipeline**, not one big prompt | Each step is small, testable, separately logged, and can fail on its own without losing the rest. Extract and summarise run in parallel. |
| **Rules, not the LLM, decide automatic actions** | Deterministic, explainable and cheap. The LLM provides the signals (category, urgency, tasks). |
| **History-API sync + client polling** | "What changed since X?" is one cheap request when nothing is new. That makes minute-by-minute checks affordable without public webhooks. |
| **Approval enforced in the database** | Prompt instructions can be ignored. A status check in `sendApprovedDraft` can't. |
| **Plain-text email rendering** | Email HTML is untrusted. Showing text only (and markdown for AI output) avoids a whole class of XSS problems. |
