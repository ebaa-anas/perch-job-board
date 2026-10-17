/**
 * Remove seed data and nothing else.
 *
 * Scope is defined by one rule: an account whose email ends in
 * `@seed.perch.test`. Deleting those accounts removes their profiles, and the
 * schema's ON DELETE CASCADE chains take the rest — companies, jobs,
 * application questions, applications, pipeline rows, events, saved jobs,
 * saved searches, notifications and reviews.
 *
 * Anything created by a real account is untouched, which is the point: this is
 * meant to be run against a database that already has real users in it, on the
 * day the demo content stops being wanted.
 *
 * Storage is handled explicitly, because buckets do not cascade: a seeded
 * seeker's CV would otherwise be left behind as an orphan.
 *
 * Run: `npm run seed:clear`
 */
import {
  SEED_DOMAIN,
  countRows,
  db,
  isSeedEmail,
  listAllUsers,
  printCounts,
} from "./seed-common";

async function main() {
  printCounts("Before clear:", await countRows());

  const users = await listAllUsers();
  const seeded = users.filter((u) => isSeedEmail(u.email));

  if (seeded.length === 0) {
    console.log(`\nNo accounts on @${SEED_DOMAIN}. Nothing to clear.`);
    return;
  }

  console.log(`\nFound ${seeded.length} seeded accounts on @${SEED_DOMAIN}.`);

  // Storage first. Once the seeker_profiles rows are gone the cv_path values
  // are unrecoverable and the files would be orphaned in the bucket for good.
  const ids = seeded.map((u) => u.id);
  const { data: cvRows } = await db
    .from("seeker_profiles")
    .select("cv_path")
    .in("profile_id", ids);
  const cvPaths = (cvRows ?? [])
    .map((r) => r.cv_path)
    .filter((p): p is string => Boolean(p));
  if (cvPaths.length > 0) {
    const { error } = await db.storage.from("cvs").remove(cvPaths);
    if (error) throw new Error(`cvs: ${error.message}`);
    console.log(`Removed ${cvPaths.length} CV files.`);
  }

  const { data: logoRows } = await db
    .from("companies")
    .select("logo_path")
    .in("owner_id", ids);
  const logoPaths = (logoRows ?? [])
    .map((r) => r.logo_path)
    .filter((p): p is string => Boolean(p));
  if (logoPaths.length > 0) {
    const { error } = await db.storage.from("logos").remove(logoPaths);
    if (error) throw new Error(`logos: ${error.message}`);
    console.log(`Removed ${logoPaths.length} logo files.`);
  }

  // Then the accounts. Everything else goes with them.
  let deleted = 0;
  for (const user of seeded) {
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`  failed to delete ${user.email}: ${error.message}`);
      continue;
    }
    deleted += 1;
  }
  console.log(`Deleted ${deleted} of ${seeded.length} accounts.`);

  // Companies seeded without an owner (older seed revisions) leave no account
  // behind to cascade from, so they are swept by their tagline marker.
  const { error: orphanError, count: orphanCount } = await db
    .from("companies")
    .delete({ count: "exact" })
    .is("owner_id", null)
    .like("tagline", "%seeded demo company%");
  if (orphanError) {
    console.error(`  orphan company sweep: ${orphanError.message}`);
  } else if ((orphanCount ?? 0) > 0) {
    console.log(`Removed ${orphanCount} ownerless demo companies.`);
  }

  printCounts("After clear:", await countRows());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
