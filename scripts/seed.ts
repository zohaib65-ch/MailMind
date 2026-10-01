/**
 * Seeds the Mock Email Mode demo: `npm run db:seed` (add `-- --ai` to also run the AI pipeline).
 * Creates the demo user "Sam Taylor", loads the mock inbox, and builds the search index.
 */
import "./_env";
import { connectDb, disconnectDb } from "@/lib/db/mongoose";
import { isAiConfigured } from "@/lib/utils/env";
import { processPendingEmails } from "@/services/ai/processing.service";
import { getOrCreateDemoUser } from "@/services/email/account.service";
import { syncUser } from "@/services/email/sync.service";
import { indexPendingEmails } from "@/services/embeddings/indexer";

async function main() {
  await connectDb();
  const user = await getOrCreateDemoUser();
  const userId = user._id.toString();
  const synced = await syncUser(userId);
  console.log(`✓ demo user ${user.email}: ${synced.reduce((n, r) => n + r.created, 0)} new emails`);

  const indexed = await indexPendingEmails(userId);
  console.log(`✓ embedded ${indexed.indexed} emails for semantic search`);

  if (process.argv.includes("--ai")) {
    if (!isAiConfigured()) {
      console.log("• Skipping AI processing: ANTHROPIC_API_KEY is not set.");
    } else {
      console.log("… running the AI pipeline (this makes several Claude calls per email)");
      const result = await processPendingEmails(userId, { limit: 100, concurrency: 2 });
      console.log(`✓ processed ${result.processed} emails (${result.failed} failed)`);
    }
  }
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
