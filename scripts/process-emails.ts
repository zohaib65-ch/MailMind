/**
 * Runs the AI pipeline from the command line: `npm run ai:process`
 *   npm run ai:process                 → every pending email, for every user
 *   npm run ai:process -- <emailId>    → one email (re-processes it if already done)
 */
import "./_env";
import { connectDb, disconnectDb } from "@/lib/db/mongoose";
import { Email, User } from "@/lib/db/models";
import { processEmail, processPendingEmails } from "@/services/ai/processing.service";

async function main() {
  await connectDb();
  const emailId = process.argv.slice(2).find((a) => /^[0-9a-f]{24}$/i.test(a));
  if (emailId) {
    const email = await Email.findById(emailId).lean();
    if (!email) throw new Error(`No email ${emailId}`);
    const result = await processEmail(email.userId.toString(), emailId, {
      force: true,
      onStep: (e) => console.log(`  ${e.status.padEnd(8)} ${e.step}${e.detail ? ` — ${e.detail}` : ""}`),
    });
    console.log(`✓ ${result.runId}: ${result.category ?? "-"} / ${result.urgency ?? "-"}${result.errors.length ? ` (errors: ${result.errors.join("; ")})` : ""}`);
  } else {
    for (const user of await User.find().select("_id email").lean()) {
      const result = await processPendingEmails(user._id.toString(), { limit: 200 });
      console.log(`✓ ${user.email}: processed ${result.processed}, failed ${result.failed}${result.skipped ? " (skipped)" : ""}`);
    }
  }
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
