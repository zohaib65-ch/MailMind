# MailMind documentation

MailMind is an AI email manager. It connects to your Gmail, reads and understands each new email (category, urgency, extracted dates and tasks, summary), and drafts replies for you to review. It never sends an email without your explicit approval.

These docs are written for developers working on MailMind. Read them in order the first time; after that, use them as a reference.

| # | Document | What it covers |
|---|---|---|
| 1 | [Overview](01-overview.md) | What MailMind does, the main ideas, and the tech stack |
| 2 | [Getting started](02-getting-started.md) | Setting up MongoDB Atlas, Gemini and Gmail OAuth, then running the app |
| 3 | [Architecture](03-architecture.md) | Layers, folder structure, and how a request flows through the code |
| 4 | [AI pipeline](04-ai-pipeline.md) | The LangGraph workflow that processes every email, step by step |
| 5 | [Gmail integration](05-gmail-integration.md) | OAuth sign-in, incremental sync with the History API, and sending |
| 6 | [Database](06-database.md) | MongoDB collections, fields, indexes and data retention |
| 7 | [API reference](07-api-reference.md) | Every HTTP endpoint the UI uses |
| 8 | [Security](08-security.md) | How keys, tokens, email content and AI actions are protected |
| 9 | [Configuration](09-configuration.md) | Every environment variable |
| 10 | [Operations](10-operations.md) | Scripts, quotas, deployment and troubleshooting |

## The 30-second version

```text
Gmail ──sync──▶ MongoDB ──▶ AI pipeline (LangGraph + Gemini) ──▶ dashboard, inbox, drafts
                                    │
                                    └──▶ reply draft ──▶ YOU approve ──▶ Gmail sends
```

- **Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS + shadcn/ui, MongoDB Atlas + Mongoose, LangChain JS + LangGraph, Google Gemini, Zod.
- **Run it:** `npm install`, fill in `.env`, `npm run db:indexes`, `npm run dev`. Details are in [Getting started](02-getting-started.md).
