# MailMind documentation

MailMind is an AI email manager. It connects to your Gmail, reads and understands each new email (category, urgency, extracted dates and tasks, summary), drafts replies, and offers an AI assistant that can search, read and draft across your inbox. It never sends an email without your explicit approval.

These docs are written for developers working on MailMind. Read them in order the first time; after that, use them as a reference.

| # | Document | What it covers |
|---|---|---|
| 1 | [Overview](01-overview.md) | What MailMind does, the main ideas, and the tech stack |
| 2 | [Getting started](02-getting-started.md) | Setting up MongoDB Atlas, Gemini and Gmail OAuth, then running the app |
| 3 | [Architecture](03-architecture.md) | Layers, folder structure, and how a request flows through the code |
| 4 | [AI pipeline](04-ai-pipeline.md) | The LangGraph workflow that processes every email, step by step |
| 5 | [Agent, tools and human approval](05-agent-and-tools.md) | The AI assistant, its tools, memory, and the approval gate for sending |
| 6 | [Search, embeddings and RAG](06-search-and-rag.md) | Keyword, semantic and hybrid search, and question answering over email |
| 7 | [Gmail integration](07-gmail-integration.md) | OAuth sign-in, incremental sync with the History API, and sending |
| 8 | [Database](08-database.md) | MongoDB collections, fields, indexes and data retention |
| 9 | [API reference](09-api-reference.md) | Every HTTP endpoint the UI uses |
| 10 | [Security](10-security.md) | How keys, tokens, email content and AI actions are protected |
| 11 | [Configuration](11-configuration.md) | Every environment variable |
| 12 | [Operations](12-operations.md) | Scripts, quotas, deployment and troubleshooting |

## The 30-second version

```text
Gmail ──sync──▶ MongoDB ──▶ AI pipeline (LangGraph + Gemini) ──▶ dashboard, inbox, drafts
                   │                                                    │
                   └──▶ embeddings (Gemini) ──▶ semantic search / RAG   │
                                                                        ▼
                      AI assistant (LangChain agent + tools) ──▶ draft ──▶ YOU approve ──▶ Gmail sends
```

- **Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS + shadcn/ui, MongoDB Atlas + Mongoose, LangChain JS + LangGraph, Google Gemini, Zod.
- **Run it:** `npm install`, fill in `.env`, `npm run db:indexes`, `npm run dev`. Details are in [Getting started](02-getting-started.md).
