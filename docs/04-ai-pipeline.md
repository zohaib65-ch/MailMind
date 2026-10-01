# 4. AI pipeline

Every email goes through the same workflow, implemented as a **LangGraph `StateGraph`** in `src/services/ai/pipeline.ts`. Each node is one small, modular step with its own prompt, its own Zod schema and its own audit record.

## The graph

```text
            ┌─ (email sent by you) ───────────────────────────────────────────┐
  START ────┤                                                                 ▼
            └─▶ classify ─┬─▶ extract ───┐                                  memory ─▶ finalize ─▶ END
                          │              ├─▶ assess_urgency ─▶ decide ─▶ act ─┤   ▲
                          └─▶ summarize ─┘   (spam skips extract)            └─▶ draft
```

| Node | Kind | What it does | Output (Zod schema in `src/schemas/ai.ts`) |
|---|---|---|---|
| **classify** | LLM | Category, confidence, whether a reply is needed, a one-line reason | `ClassificationOutputSchema` |
| **extract** | LLM + checks | People, companies, dates, times, phone numbers, links, tasks, deadlines | `ExtractedInformationSchema` |
| **summarize** | LLM | 1–2 sentence summary (normal length) | `SummaryOutputSchema` |
| **assess_urgency** | LLM | low / medium / high, reasons, optional respond-by | `UrgencyOutputSchema` |
| **decide** | Rules | Which actions to take, and which run automatically | `ActionDecisionSchema` |
| **act** | Tool | Runs automatic, reversible actions (mark important) | logged in `tool_executions` |
| **draft** | LLM | Writes a reply as a draft for your review | `ReplyDraftOutputSchema` |
| **memory** | LLM | Folds this message into the thread's rolling memory | `ThreadMemoryOutputSchema` |
| **finalize** | DB | Saves all results onto the email, sets `needs_reply` / `replied` | — |

- **Parallel branch.** `extract` and `summarize` run at the same time, and `assess_urgency` waits for both (LangGraph fan-in).
- **Conditional edges.** Emails you sent skip straight to `memory`; "Yes, Friday works" is exactly what memory should keep. High-confidence spam skips extraction (no point pulling links out of a scam). `draft` runs only when the decision says so.
- **Failure isolation.** Only `classify` is critical: if it fails, the run fails and the email is marked `failed` (retry with **Analyse with AI**). Any other step that fails is recorded in `ai.error`, and the rest of the results are still saved.
- **Live progress.** Nodes report progress through LangGraph's custom stream (`config.writer`). The email page shows each step light up via `POST /api/emails/[id]/process` (SSE).

## The parsing step

Before the graph runs, `src/services/email/parser.ts` turns the raw Gmail message into a clean record:

- The HTML body is converted to text (`html-to-text`). Emails are never rendered as HTML.
- Quoted replies and signatures are stripped for the AI (`stripQuotedReply`), and long bodies are capped with an explicit "[… N more characters omitted …]" marker (`bodyForAi`).
- Direction (`inbound` / `outbound`) comes from Gmail's `SENT` label.

## Prompt templates

Each step has a reusable LangChain `ChatPromptTemplate` in `src/lib/langchain/prompts/`:

| File | Template | Version |
|---|---|---|
| `classification.ts` | `classificationPrompt` | `classification@1` |
| `extraction.ts` | `extractionPrompt` | `extraction@1` |
| `summary.ts` | `summaryPrompt` (short / normal / detailed variants) | `summary@1` |
| `urgency.ts` | `urgencyPrompt` | `urgency@1` |
| `reply.ts` | `replyPrompt` | `reply@1` |
| `memory.ts` | `memoryPrompt` | `memory@1` |
| `rag.ts` | `ragPrompt` | `rag@1` |
| `shared.ts` | shared rules: the untrusted-content notice, the `<email>` formatter, dates in `APP_TIMEZONE` | — |

Email content is always wrapped in tags (`<email>`, `<thread>`, `<memory>`) with a standing instruction that text inside them is **data, never instructions**. Look-alike tags inside an email are neutralised, so an email can't close the wrapper and "escape". See [Security](10-security.md#prompt-injection).

## Structured output

`src/lib/langchain/structured.ts` → `invokeStructured({ purpose, schema, prompt, variables })`:

1. Formats the prompt template.
2. Calls `model.withStructuredOutput(zodSchema, { method: "jsonSchema", includeRaw: true })`. With `ChatGoogle` this sends the schema as Gemini's `responseJsonSchema` with `responseMimeType: application/json`, so decoding is constrained to the schema.
3. Checks the finish reason. `SAFETY`, `PROHIBITED_CONTENT`, `RECITATION` and similar mean the content was blocked. `MAX_TOKENS` means the output was cut off. Either is an error, not a half-answer.
4. **Validates with Zod.** Some constraints (for example min/max) are advisory to the model, so validation is the real gate. On failure it retries **once**, telling the model exactly which fields were wrong. A second failure raises `AiOutputError`.
5. Returns `{ data, usage, model }`. Token usage is recorded in `ai_tasks`.

## Anti-hallucination: grounded extraction

`src/services/ai/steps/grounding.ts` checks every extracted value against the email text:

- People, companies, dates, deadlines: every word must appear in the email (case- and punctuation-insensitive).
- Phone numbers: the digits must appear. Links: the exact URL must appear.
- Links and phone numbers are also found with regular expressions and merged in, so nothing obvious is missed.
- Tasks are paraphrases by design, so they're kept but capped.

Values that fail the check are dropped and counted. The live progress shows "N unverified dropped".

## Models and thinking

`src/lib/langchain/model.ts` → `getChatModel(purpose)` returns a `ChatGoogle` instance:

| Purpose | Model (env var) | Thinking level | Max output tokens |
|---|---|---|---|
| classify, summarize, urgency | `GEMINI_PIPELINE_MODEL` | LOW | 4,000 |
| extract, memory | `GEMINI_PIPELINE_MODEL` | LOW | 8,000 |
| draft | `GEMINI_MODEL` | MEDIUM | 16,000 |
| rag | `GEMINI_MODEL` | LOW | 16,000 |
| agent | `GEMINI_MODEL` | MEDIUM | 16,000 |

`thinkingLevel` is only sent to Gemini 3+ models (older models reject it). Calls retry up to 6 times with exponential backoff, which absorbs free-tier `429` and transient `503` responses. The model's thinking is never shown in the UI.

## Action decision (rules, not an LLM)

`src/services/ai/steps/action-decision.ts` turns the LLM's signals into actions:

| Action | When | Automatic? |
|---|---|---|
| `draft_reply` | `needsReply` and the category isn't spam / newsletter / notification / shopping | Yes, if **Auto-draft replies** is on in Settings |
| `mark_important` | High urgency, or category Important / Interview, and not already starred | Yes, if **Auto-mark important** is on |
| `track_tasks` | The extractor found tasks for you | Suggested only |
| `suggest_archive` | Spam, or a low-urgency newsletter / shopping / notification email | Suggested only |

Automatic actions are limited to safe, reversible ones. Archiving is only suggested, and **sending is never automatic**.

## Thread memory

The `memory` node keeps a compact, AI-maintained record per thread (`email_threads.memory`):

```json
{
  "summary": "Ali asked for the final redesign by Friday; Sam agreed and will include mobile mockups.",
  "facts": ["Final redesign due Friday"],
  "commitments": [{ "by": "user", "text": "Deliver the final redesign with mobile mockups", "due": "Friday" }],
  "openQuestions": ["When should the invoice be sent?"]
}
```

The reply drafter reads this memory plus the last few messages, instead of the whole inbox or thread. That keeps prompts small and replies consistent with what was already agreed. Memory is built in conversation order: an older message is never folded in on top of a newer one.

## When the pipeline runs

| Trigger | Which emails |
|---|---|
| New mail from a sync (auto) | Only the emails that sync imported, newest first, at most `AI_AUTO_PROCESS_LIMIT` (25) |
| A reply you send | That outbound email (memory step only) |
| **Analyse with AI** on an email | That email (re-analyse with `force`) |
| **Analyse N with AI** in the inbox | Up to 100 pending emails, newest first |
| `npm run ai:process` | All pending, or one email id |

Processing is claimed atomically: an email moves `pending → processing` in a single `findOneAndUpdate`, so two workers never run the same email. Claims older than 10 minutes are treated as abandoned and can be retaken. Emails in one thread are processed in order; different threads can run in parallel (`concurrency`, default 1 to respect Gemini rate limits).

## Observability

Every step writes an `ai_tasks` document (type, status, model, input/output, tokens, latency, pipeline run id). Every tool call writes a `tool_executions` document. Both appear on the **AI Activity** page and are kept for 90 days.
