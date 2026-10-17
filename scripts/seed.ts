/**
 * Seed a demo data set.
 *
 * Every account is created on `@seed.perch.test`, which is what makes the whole
 * set removable with `npm run seed:clear` before launch. Companies, jobs,
 * applications and saved jobs all hang off those accounts through foreign keys
 * with ON DELETE CASCADE, so clearing the accounts clears the data.
 *
 * Idempotent: re-running updates the same rows rather than duplicating them.
 *
 * Run: `npm run seed`
 */
import { SEED_JOBS } from "../src/features/jobs/seed";
import {
  SEED_DOMAIN,
  countRows,
  db,
  listAllUsers,
  printCounts,
  slugify,
} from "./seed-common";

/** Shared across seeded accounts; these are demo logins, not real ones. */
const SEED_PASSWORD = "perch-demo-2026";

const RECRUITERS = [
  { handle: "nadia", name: "Nadia Yılmaz" },
  { handle: "omar", name: "Omar Haddad" },
  { handle: "sofia", name: "Sofia Marchetti" },
];

const SEEKERS = [
  { handle: "amir", name: "Amir Rahimi", headline: "Mobile developer, 3y", skills: ["Flutter", "Dart", "Firebase"] },
  { handle: "lina", name: "Lina Chowdhury", headline: "Frontend engineer", skills: ["React", "TypeScript", "Next.js"] },
  { handle: "yusuf", name: "Yusuf Demir", headline: "Recent CS graduate", skills: ["Python", "SQL"] },
  { handle: "mei", name: "Mei Tanaka", headline: "Product designer", skills: ["Figma", "Design Systems"] },
];

function emailFor(handle: string): string {
  return `${handle}@${SEED_DOMAIN}`;
}

/** Create the account if absent, return its id either way. */
async function upsertUser(
  email: string,
  fullName: string,
  role: "seeker" | "recruiter",
  existing: Map<string, string>,
): Promise<string> {
  const found = existing.get(email.toLowerCase());
  if (found) return found;

  const { data, error } = await db.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function main() {
  printCounts("Before seed:", await countRows());

  const existing = new Map(
    (await listAllUsers()).map((u) => [u.email.toLowerCase(), u.id]),
  );

  // 1. Accounts. The handle_new_user trigger creates the matching profiles row.
  const recruiterIds = new Map<string, string>();
  for (const r of RECRUITERS) {
    recruiterIds.set(
      r.handle,
      await upsertUser(emailFor(r.handle), r.name, "recruiter", existing),
    );
  }

  const seekerIds = new Map<string, string>();
  for (const s of SEEKERS) {
    seekerIds.set(
      s.handle,
      await upsertUser(emailFor(s.handle), s.name, "seeker", existing),
    );
  }

  // 2. Seeker profiles, including the 0022 matching fields so the demo shows
  //    the parts of the product that depend on them.
  const profiles = SEEKERS.map((s, i) => ({
    profile_id: seekerIds.get(s.handle)!,
    headline: s.headline,
    location: i % 2 === 0 ? "Istanbul, Türkiye" : "Remote",
    bio: `${s.headline}. Seeded demo account.`,
    skills: s.skills,
    experience: (["mid", "mid", "junior", "senior"] as const)[i],
    no_professional_experience: s.handle === "yusuf",
    needs_visa_sponsorship: s.handle === "amir" || s.handle === "mei",
    work_authorization: s.handle === "yusuf" ? "student" : "citizen",
    desired_types: ["full-time"],
    desired_work_modes: i % 2 === 0 ? ["hybrid"] : ["remote"],
    desired_locations: ["Istanbul"],
  }));
  const profileResult = await db
    .from("seeker_profiles")
    .upsert(profiles, { onConflict: "profile_id" });
  if (profileResult.error) throw new Error(profileResult.error.message);

  // 3. One company per recruiter, named from the bundled demo jobs.
  const companyNames = [...new Set(SEED_JOBS.map((j) => j.company))].slice(
    0,
    RECRUITERS.length,
  );
  const companyIds = new Map<string, string>();
  for (const [i, name] of companyNames.entries()) {
    const recruiter = RECRUITERS[i];
    const { data, error } = await db
      .from("companies")
      .upsert(
        {
          owner_id: recruiterIds.get(recruiter.handle)!,
          name,
          slug: slugify(name),
          tagline: `${name} — seeded demo company`,
          logo_color:
            SEED_JOBS.find((j) => j.company === name)?.companyLogoColor ?? "#1e5f45",
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`company ${name}: ${error.message}`);
    companyIds.set(name, data.id);
  }

  // 4. Jobs, spread across the companies round-robin. Using only the jobs
  //    whose own company name matched would leave a board with three
  //    listings on it, which is not a demo of anything.
  const companyIdList = [...companyIds.values()];
  const jobRows = SEED_JOBS.map((j, i) => ({
    company_id: companyIdList[i % companyIdList.length],
    slug: slugify(`${j.title}-${i + 1}`),
    title: j.title,
    location: j.location,
    type: j.type,
    work_mode: j.workMode,
    experience: j.experience,
    salary_min: j.salaryMin,
    salary_max: j.salaryMax,
    currency: j.currency,
    description: j.description,
    responsibilities: j.responsibilities,
    requirements: j.requirements,
    perks: j.perks,
    tags: j.tags,
    status: "published",
    visa_sponsorship: j.experience !== "lead",
    no_experience_required: j.experience === "junior",
  }));
  const { data: jobs, error: jobsError } = await db
    .from("jobs")
    .upsert(jobRows, { onConflict: "slug" })
    .select("id, slug");
  if (jobsError) throw new Error(`jobs: ${jobsError.message}`);

  // 5. A few applications and saved jobs, so the pipeline and dashboard are
  //    not empty on a fresh install.
  const seekerList = [...seekerIds.values()];
  const applications = (jobs ?? []).slice(0, 4).flatMap((job, i) =>
    seekerList.slice(0, 2).map((seekerId, k) => ({
      job_id: job.id,
      seeker_id: seekerList[(i + k) % seekerList.length],
      note: "Seeded demo application.",
    })),
  );
  const seen = new Set<string>();
  const uniqueApplications = applications.filter((a) => {
    const key = `${a.job_id}:${a.seeker_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (uniqueApplications.length > 0) {
    const { error } = await db
      .from("applications")
      .upsert(uniqueApplications, { onConflict: "job_id,seeker_id" });
    if (error) throw new Error(`applications: ${error.message}`);
  }

  const savedJobs = (jobs ?? []).slice(0, 3).map((job) => ({
    seeker_id: seekerList[0],
    job_id: job.id,
  }));
  if (savedJobs.length > 0) {
    const { error } = await db
      .from("saved_jobs")
      .upsert(savedJobs, { onConflict: "seeker_id,job_id" });
    if (error) throw new Error(`saved_jobs: ${error.message}`);
  }

  // 6. Admin access, only when an address is configured. No personal address
  //    is baked into the repository.
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail) {
    const { error } = await db
      .from("admin_emails")
      .upsert({ email: adminEmail }, { onConflict: "email" });
    if (error) throw new Error(`admin_emails: ${error.message}`);
    console.log(`\nAdmin access granted to ${adminEmail}`);
  } else {
    console.log(
      "\nSEED_ADMIN_EMAIL not set — no admin address added. Set it in .env.local to reach /admin.",
    );
  }

  printCounts("After seed:", await countRows());
  console.log(
    `\nSeeded ${RECRUITERS.length} recruiters, ${SEEKERS.length} seekers, ` +
      `${companyIds.size} companies, ${jobs?.length ?? 0} jobs, ` +
      `${uniqueApplications.length} applications.`,
  );
  console.log(`All demo accounts: <handle>@${SEED_DOMAIN} / ${SEED_PASSWORD}`);
  console.log("Remove it all with: npm run seed:clear");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
