/**
 * Seed the demo data set: two shared logins a visitor can borrow
 * (`demo-seeker@` and `demo-recruiter@seed.perch.test`) and the companies,
 * jobs and applicants around them. The data itself is in
 * `src/features/demo/seed-plan.ts`.
 *
 * Passwords never live in the repository. The two shared logins take
 * DEMO_SEEKER_PASSWORD and DEMO_RECRUITER_PASSWORD from the environment;
 * every other seeded account gets a fresh random password on every run, so
 * nobody can sign in to them at all.
 *
 * Safe to re-run. `npm run seed:clear` removes all of it; `npm run demo:reset`
 * does both, which is what the daily cron runs.
 */
import { seedDemoData } from "../src/features/demo/reset";
import { DEMO_ACCOUNTS } from "../src/features/demo/demo-rules";
import { countRows, db, printCounts } from "./seed-common";

async function main() {
  printCounts("Before seed:", await countRows());

  const summary = await seedDemoData(db, {
    passwords: {
      seeker: process.env.DEMO_SEEKER_PASSWORD,
      recruiter: process.env.DEMO_RECRUITER_PASSWORD,
    },
    adminEmail: process.env.SEED_ADMIN_EMAIL,
    log: (line) => console.log(line),
  });

  printCounts("After seed:", await countRows());
  console.log(
    `\nSeeded ${summary.accounts} accounts, ${summary.companies} companies, ` +
      `${summary.jobs} jobs, ${summary.applications} applications.`,
  );
  for (const role of ["seeker", "recruiter"] as const) {
    const source =
      summary.logins[role] === "configured"
        ? "password from the environment"
        : "random password — set the DEMO_*_PASSWORD variable for one-click sign-in";
    console.log(`  ${DEMO_ACCOUNTS[role].email}: ${source}`);
  }
  if (!process.env.SEED_ADMIN_EMAIL) {
    console.log("SEED_ADMIN_EMAIL not set — no admin address added.");
  }
  console.log("Remove it all with: npm run seed:clear");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
