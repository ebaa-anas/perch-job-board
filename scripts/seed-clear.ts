/**
 * Remove seed data and nothing else.
 *
 * Scope is one rule: an account whose email ends in `@seed.perch.test`.
 * Deleting those accounts removes their profiles, and the schema's ON DELETE
 * CASCADE chains take the rest. Storage is cleared first, folder by folder,
 * because buckets do not cascade.
 *
 * Anything created by a real account is untouched, which is the point: this
 * can run against a database that already has real users in it.
 *
 * Run: `npm run seed:clear`
 */
import { clearDemoData } from "../src/features/demo/reset";
import { countRows, db, printCounts } from "./seed-common";

async function main() {
  printCounts("Before clear:", await countRows());

  const summary = await clearDemoData(db, (line) => console.log(line));
  console.log(
    `\nDeleted ${summary.accounts} accounts` +
      (summary.failed ? ` (${summary.failed} failed)` : "") +
      `, removed ${summary.files} files` +
      (summary.legacyCompanies ? ` and ${summary.legacyCompanies} ownerless demo companies` : "") +
      ".",
  );

  printCounts("After clear:", await countRows());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
