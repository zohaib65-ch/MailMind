# 2. Getting started

You need three things: a MongoDB Atlas database, a Gemini API key, and a Google OAuth client for Gmail. All are free to set up.

## Prerequisites

- Node.js **20.9 or newer** (Next.js 16 requirement). `node -v` to check.
- npm (comes with Node).
- A Google account with Gmail.

## 1. Install dependencies

```bash
npm install
```

## 2. Create `.env`

```bash
cp .env.example .env
```

Fill it in using the sections below. Every variable is described in [Configuration](09-configuration.md). `.env` is gitignored: never commit it.

## 3. MongoDB Atlas

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com). The M0 tier is enough.
2. **Database Access** → add a database user with a password.
3. **Network Access** → add your IP address (or `0.0.0.0/0` while developing).
4. **Connect → Drivers** → copy the connection string into `.env`:

   ```bash
   MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority"
   MONGODB_DB="mailmind"
   ```

   `MONGODB_DB` picks the database name. It overrides any name in the URI path.

5. Create the indexes:

   ```bash
   npm run db:indexes
   ```

   This syncs the indexes defined on the Mongoose schemas, including the text index that inbox keyword search uses.

## 4. Gemini API key

1. Open [Google AI Studio → API keys](https://aistudio.google.com/apikey) and create a key.
2. Put it in `.env`:

   ```bash
   GEMINI_API_KEY="your-key"
   ```

One key covers everything: the pipeline and reply drafts. Defaults:

| Purpose | Model | Variable |
|---|---|---|
| Reply drafts | `gemini-3.5-flash` | `GEMINI_MODEL` |
| Pipeline steps (classify, extract, summarise, urgency, memory) | `gemini-3.5-flash-lite` | `GEMINI_PIPELINE_MODEL` |

> **Free tier:** free keys have per-minute and per-day limits, and Pro models may not be available at all. MailMind retries rate-limited calls with backoff, and analyses at most `AI_AUTO_PROCESS_LIMIT` (default 25) new emails automatically per sync. See [Operations → Gemini quota](10-operations.md#gemini-quota).

## 5. Gmail (Google OAuth client)

MailMind signs you in with Google and reads your Gmail through the official Gmail API. It needs an OAuth client you create once:

1. Go to the [Google Cloud console](https://console.cloud.google.com/) and create (or pick) a project.
2. **APIs & Services → Library** → search **Gmail API** → **Enable**.
3. **APIs & Services → OAuth consent screen** (or **Google Auth Platform → Branding/Audience**):
   - User type **External**, app name "MailMind", your email as support and developer contact.
   - **Scopes**: add `openid`, `email`, `profile` and `https://www.googleapis.com/auth/gmail.modify`.
   - **Test users**: add the Gmail address(es) you will sign in with. While the app is in *Testing*, only test users can sign in.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type **Web application**.
   - **Authorised redirect URI**: `http://localhost:3000/api/auth/google/callback`
5. Copy the client ID and secret into `.env`:

   ```bash
   GOOGLE_CLIENT_ID="1234567890-abc.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="GOCSPX-..."
   ```

6. Set an encryption key before the first sign-in. It encrypts your Gmail tokens at rest, so keep it stable afterwards:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   # → paste into ENCRYPTION_KEY="..."
   ```

> **Why `gmail.modify`?** It lets MailMind read mail, change labels (archive, star, mark read) and send replies, but not permanently delete anything. Google treats it as a *restricted* scope: fine for personal use in Testing mode. Publishing the app to other users requires Google's verification. In Testing mode Google expires refresh tokens after 7 days, so you'll be asked to sign in again weekly.

## 6. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Sign in with Google** → allow Gmail access.

What happens next:

1. You land on the dashboard immediately. In the background, MailMind imports the last `GMAIL_INITIAL_SYNC_DAYS` (30) days of mail, up to `GMAIL_SYNC_MAX_MESSAGES` (200).
2. The newest `AI_AUTO_PROCESS_LIMIT` (25) emails go through the AI pipeline (when `AI_AUTO_PROCESS` is on). Older ones show **Not analysed yet**. Analyse them from the email page, or with **Analyse N with AI** in the inbox.
3. While a MailMind tab is open, it checks Gmail every `GMAIL_POLL_SECONDS` (60) seconds. New mail appears with a toast and is processed automatically.

## 7. Production build

```bash
npm run build
npm start
```

Before deploying, see [Operations → Deployment](10-operations.md#deployment) for the production checklist (HTTPS `APP_URL`, redirect URI, `ENCRYPTION_KEY`, Redis).

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates Next route types, then runs `tsc --noEmit` |
| `npm run db:indexes` | Syncs the MongoDB indexes defined on the Mongoose schemas |
| `npm run ai:process` | Runs the AI pipeline on pending emails from the CLI (`-- <emailId>` for one email) |
