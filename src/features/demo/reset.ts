/**
 * Clear and rebuild the demo data set.
 *
 * One implementation behind `npm run seed`, `npm run seed:clear` and the daily
 * `/api/cron/demo-reset`, so the CLI and the cron cannot drift apart. The
 * caller passes a service-role client: the scripts build theirs from
 * `.env.local`, the route uses `createAdminClient`.
 *
 * Deliberately free of `server-only` — it throws outside a Next.js server
 * bundle, which would break the scripts.
 */
import { randomBytes } from "node:crypto";

import type { createClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/supabase/database.types";
import type { ApplicationStage } from "@/features/applications/pipeline";
import { preferencesToQuery } from "@/features/alerts/from-preferences";
import { buildCvPdf } from "@/features/demo/demo-cv";
import { DEMO_EMAIL_DOMAIN, isDemoUser, type DemoRole } from "@/features/demo/demo-rules";
import {
  SEED_ACCOUNTS,
  SEED_APPLICATIONS,
  SEED_COMPANIES,
  SEED_JOB_PLAN,
  SEED_SAVED_JOBS,
  SEED_SEEKER_PROFILES,
  SEED_TEAM_MEMBERS,
  SEED_VIEW_DAYS,
  type SeedApplication,
} from "@/features/demo/seed-plan";

export type ServiceClient = ReturnType<typeof createClient<Database>>;
type Log = (line: string) => void;

const DAY_MS = 86_400_000;
/** Every bucket an account can write to; paths start with the owner's uid. */
const STORAGE_BUCKETS = ["cvs", "logos", "avatars"] as const;
/** Ownerless companies from older seed revisions carry this in their tagline. */
const LEGACY_COMPANY_MARKER = "%seeded demo company%";
const CV_FILE = "seed-cv.pdf";

const noop: Log = () => {};

/** `auth.users` is paginated; walk it rather than assuming one page. */
export async function listAllUsers(db: ServiceClient): Promise<{ id: string; email: string }[]> {
  const users: { id: string; email: string }[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const batch = data?.users ?? [];
    for (const user of batch) users.push({ id: user.id, email: (user.email ?? "").toLowerCase() });
    if (batch.length < 200) break;
  }
  return users;
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

export interface ClearSummary {
  accounts: number;
  failed: number;
  files: number;
  legacyCompanies: number;
}

/**
 * Remove every account on the demo domain and everything hanging off it.
 *
 * Scope is one rule — the email domain — so nothing a real account created can
 * be caught. Deleting the accounts lets ON DELETE CASCADE take their profiles,
 * companies, jobs, applications, pipeline, events, saved jobs, alerts,
 * notifications and reviews. Storage does not cascade, so it goes first: once
 * an account is gone, nothing records which folder was theirs.
 */
export async function clearDemoData(db: ServiceClient, log: Log = noop): Promise<ClearSummary> {
  const seeded = (await listAllUsers(db)).filter((user) => isDemoUser(user.email));
  if (seeded.length === 0) log(`No accounts on @${DEMO_EMAIL_DOMAIN}.`);

  let files = 0;
  for (const user of seeded) files += await removeUserFiles(db, user.id);

  let accounts = 0;
  let failed = 0;
  for (const user of seeded) {
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) {
      // Not fatal: the seed that follows reuses any account still present.
      log(`  failed to delete ${user.email}: ${error.message}`);
      failed += 1;
      continue;
    }
    accounts += 1;
  }

  const { error, count } = await db
    .from("companies")
    .delete({ count: "exact" })
    .is("owner_id", null)
    .like("tagline", LEGACY_COMPANY_MARKER);
  if (error) throw new Error(`legacy company sweep: ${error.message}`);

  return { accounts, failed, files, legacyCompanies: count ?? 0 };
}

/**
 * Everything under `<uid>/` in every bucket — not just the current CV or logo
 * path, so files a visitor replaced, or nested a level down, go too.
 */
async function removeUserFiles(db: ServiceClient, userId: string): Promise<number> {
  let removed = 0;
  for (const bucket of STORAGE_BUCKETS) {
    const paths = await listFiles(db, bucket, userId, 0);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await db.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) throw new Error(`${bucket}: ${error.message}`);
    }
    removed += paths.length;
  }
  return removed;
}

async function listFiles(
  db: ServiceClient,
  bucket: string,
  prefix: string,
  depth: number,
): Promise<string[]> {
  const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) {
    // A bucket this project never created has nothing in it to clear.
    if (/not found/i.test(error.message)) return [];
    throw new Error(`${bucket} list: ${error.message}`);
  }
  const files: string[] = [];
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`;
    // Folders come back without an id.
    if (entry.id === null) {
      if (depth < 4) files.push(...(await listFiles(db, bucket, path, depth + 1)));
    } else {
      files.push(path);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export interface SeedOptions {
  /** The shared logins' passwords. Missing ones get a random value nobody knows. */
  passwords?: Partial<Record<DemoRole, string | null | undefined>>;
  /** Added to `admin_emails` when set. A demo address is refused. */
  adminEmail?: string | null;
  log?: Log;
  /** Clock override for tests. */
  now?: number;
}

export interface SeedSummary {
  accounts: number;
  companies: number;
  jobs: number;
  applications: number;
  /** Whether each shared login got its configured password or a random one. */
  logins: Record<DemoRole, "configured" | "random">;
}

/**
 * Build the demo set. Safe to re-run: keyed rows are upserted, and rows with
 * no natural key (events, notes, notifications, questions, alerts) are
 * replaced for the seeded records only.
 *
 * Every run re-keys every seeded account. The shared logins take their
 * password from the environment; every other account gets a fresh random one,
 * so the background cast can never be signed in to.
 */
export async function seedDemoData(
  db: ServiceClient,
  options: SeedOptions = {},
): Promise<SeedSummary> {
  const log = options.log ?? noop;
  const now = options.now ?? Date.now();
  const at = (daysAgo: number) => new Date(now - daysAgo * DAY_MS).toISOString();

  const adminEmail = options.adminEmail?.trim().toLowerCase() || null;
  if (adminEmail && isDemoUser(adminEmail)) {
    throw new Error(`Refusing to make the demo account ${adminEmail} an admin.`);
  }

  // 1. Accounts. handle_new_user creates each profiles row on insert.
  const existing = new Map((await listAllUsers(db)).map((user) => [user.email, user.id]));
  const ids = new Map<string, string>();
  const logins: SeedSummary["logins"] = { seeker: "random", recruiter: "random" };

  for (const account of SEED_ACCOUNTS) {
    const configured = account.demoRole ? options.passwords?.[account.demoRole] : null;
    const password = configured?.trim() ? configured : randomPassword();
    if (account.demoRole && configured?.trim()) logins[account.demoRole] = "configured";

    const metadata = { full_name: account.fullName, role: account.role };
    const found = existing.get(account.email);
    if (found) {
      const { error } = await db.auth.admin.updateUserById(found, {
        password,
        user_metadata: metadata,
      });
      if (error) throw new Error(`updateUser ${account.email}: ${error.message}`);
      ids.set(account.key, found);
    } else {
      const { data, error } = await db.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error) throw new Error(`createUser ${account.email}: ${error.message}`);
      ids.set(account.key, data.user.id);
    }
  }
  const idOf = (key: string) => required(ids.get(key), `account ${key}`);

  // A re-run must converge names and roles too, not only create.
  await check(
    db.from("profiles").upsert(
      SEED_ACCOUNTS.map((account) => ({
        id: idOf(account.key),
        full_name: account.fullName,
        role: account.role,
      })),
      { onConflict: "id" },
    ),
    "profiles",
  );

  // 2. Seeker profiles, each with a real PDF behind "Download CV".
  for (const profile of SEED_SEEKER_PROFILES) {
    const path = `${idOf(profile.account)}/${CV_FILE}`;
    const { error } = await db.storage
      .from("cvs")
      .upload(path, buildCvPdf(profile.cv.lines), { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`cv ${profile.account}: ${error.message}`);
  }
  await check(
    db.from("seeker_profiles").upsert(
      SEED_SEEKER_PROFILES.map((profile) => ({
        profile_id: idOf(profile.account),
        headline: profile.headline,
        location: profile.location,
        bio: profile.bio,
        skills: profile.skills,
        experience: profile.experience,
        no_professional_experience: profile.noProfessionalExperience,
        needs_visa_sponsorship: profile.needsVisaSponsorship,
        work_authorization: profile.workAuthorization,
        desired_types: profile.desiredTypes,
        desired_work_modes: profile.desiredWorkModes,
        desired_locations: profile.desiredLocations,
        open_to_work: profile.openToWork,
        portfolio_url: profile.portfolioUrl,
        cv_path: `${idOf(profile.account)}/${CV_FILE}`,
        cv_filename: profile.cv.filename,
        updated_at: at(1),
      })),
      { onConflict: "profile_id" },
    ),
    "seeker_profiles",
  );

  // 3. Companies. on_company_created gives each owner their seat.
  const companyIds = new Map<string, string>();
  for (const company of SEED_COMPANIES) {
    const { data, error } = await db
      .from("companies")
      .upsert(
        {
          owner_id: idOf(company.owner),
          name: company.name,
          slug: company.slug,
          tagline: company.tagline,
          description: company.description,
          website: company.website,
          logo_color: company.logoColor,
          language: "en",
          // Service role only: the 0021 trigger refuses these from a session.
          verified_at: company.verifiedDomain ? at(30) : null,
          verified_domain: company.verifiedDomain,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`company ${company.name}: ${error.message}`);
    companyIds.set(company.key, data.id);
  }
  const companyOf = (key: string) => required(companyIds.get(key), `company ${key}`);

  await check(
    db.from("company_members").upsert(
      SEED_TEAM_MEMBERS.map((member) => ({
        company_id: companyOf(member.company),
        profile_id: idOf(member.account),
        role: member.role,
      })),
      { onConflict: "company_id,profile_id" },
    ),
    "company_members",
  );

  // 4. Jobs.
  const { data: jobRows, error: jobsError } = await db
    .from("jobs")
    .upsert(
      SEED_JOB_PLAN.map((job) => ({
        company_id: companyOf(job.company),
        slug: job.slug,
        title: job.title,
        location: job.location,
        type: job.type,
        work_mode: job.workMode,
        experience: job.experience,
        salary_min: job.salaryMin,
        salary_max: job.salaryMax,
        currency: job.currency,
        description: job.description,
        responsibilities: job.responsibilities,
        requirements: job.requirements,
        perks: job.perks,
        tags: job.tags,
        status: job.status,
        visa_sponsorship: job.visaSponsorship,
        no_experience_required: job.noExperienceRequired,
        language: "en",
        featured_until: job.featuredForDays
          ? new Date(now + job.featuredForDays * DAY_MS).toISOString()
          : null,
        created_at: at(job.postedDaysAgo),
        updated_at: at(job.postedDaysAgo),
      })),
      { onConflict: "slug" },
    )
    .select("id, slug");
  if (jobsError) throw new Error(`jobs: ${jobsError.message}`);
  const jobIdBySlug = new Map((jobRows ?? []).map((row) => [row.slug, row.id]));
  const jobIds = new Map(
    SEED_JOB_PLAN.map((job) => [job.key, required(jobIdBySlug.get(job.slug), `job ${job.slug}`)]),
  );
  const jobOf = (key: string) => required(jobIds.get(key), `job ${key}`);
  const planOf = (key: string) => required(SEED_JOB_PLAN.find((job) => job.key === key), `plan ${key}`);
  const ownerOfJob = (key: string) =>
    idOf(required(SEED_COMPANIES.find((c) => c.key === planOf(key).company), `company of ${key}`).owner);
  const companyNameOfJob = (key: string) =>
    required(SEED_COMPANIES.find((c) => c.key === planOf(key).company), `company of ${key}`).name;

  // 5. Screening questions — no natural key, so replaced.
  const gatedJobs = SEED_JOB_PLAN.filter((job) => job.questions.length > 0);
  await check(
    db
      .from("job_application_questions")
      .delete()
      .in("job_id", gatedJobs.map((job) => jobOf(job.key))),
    "clear questions",
  );
  const { data: questionRows, error: questionsError } = await db
    .from("job_application_questions")
    .insert(
      gatedJobs.flatMap((job) =>
        job.questions.map((question, position) => ({
          job_id: jobOf(job.key),
          label: question.label,
          type: question.type,
          required: question.required,
          knockout_answer: question.knockoutAnswer,
          position,
        })),
      ),
    )
    .select("id, job_id, label, type, position");
  if (questionsError) throw new Error(`questions: ${questionsError.message}`);
  const questionsFor = (jobId: string) =>
    (questionRows ?? [])
      .filter((row) => row.job_id === jobId)
      .sort((a, b) => a.position - b.position);

  // 6. Applications. on_application_created opens each one at "applied".
  const { data: appRows, error: appsError } = await db
    .from("applications")
    .upsert(
      SEED_APPLICATIONS.map((app) => {
        const seekerId = idOf(app.seeker);
        const profile = required(
          SEED_SEEKER_PROFILES.find((p) => p.account === app.seeker),
          `profile ${app.seeker}`,
        );
        const answers = questionsFor(jobOf(app.job)).map((question, index) => ({
          questionId: question.id,
          label: question.label,
          type: question.type,
          answer: app.answers[index] ?? (question.type === "yes_no" ? false : ""),
        }));
        return {
          job_id: jobOf(app.job),
          seeker_id: seekerId,
          via: "onsite",
          note: app.note,
          cv_path: app.attachCv ? `${seekerId}/${CV_FILE}` : null,
          cv_filename: app.attachCv ? profile.cv.filename : null,
          custom_answers: answers as unknown as Json,
          created_at: at(app.daysAgo),
        };
      }),
      { onConflict: "job_id,seeker_id" },
    )
    .select("id, job_id, seeker_id");
  if (appsError) throw new Error(`applications: ${appsError.message}`);
  const appIdOf = (app: SeedApplication) =>
    required(
      (appRows ?? []).find((row) => row.job_id === jobOf(app.job) && row.seeker_id === idOf(app.seeker))
        ?.id,
      `application ${app.seeker} → ${app.job}`,
    );

  await check(
    db.from("application_pipeline").upsert(
      SEED_APPLICATIONS.map((app) => {
        const last = app.steps.at(-1);
        const first = app.steps[0];
        return {
          application_id: appIdOf(app),
          stage: last?.stage ?? "applied",
          rating: app.rating,
          // The first human response, which the public response rate counts.
          decided_at: first ? at(first.daysAgo) : null,
          updated_at: at(last?.daysAgo ?? app.daysAgo),
          updated_by: last ? ownerOfJob(app.job) : null,
        };
      }),
      { onConflict: "application_id" },
    ),
    "pipeline",
  );

  // 7. The timeline each side sees: stage changes for the candidate, notes for
  //    the hiring team only. Append-only for users; replaced here.
  const appIds = SEED_APPLICATIONS.map(appIdOf);
  await check(db.from("application_events").delete().in("application_id", appIds), "clear events");
  await check(
    db.from("application_events").insert(
      SEED_APPLICATIONS.flatMap((app) => {
        const applicationId = appIdOf(app);
        const actor = ownerOfJob(app.job);
        let from: ApplicationStage = "applied";
        const changes = app.steps.map((step) => {
          const event = {
            application_id: applicationId,
            actor_id: actor,
            kind: "stage_change",
            from_stage: from,
            to_stage: step.stage,
            body: step.message ?? null,
            visibility: "seeker",
            created_at: at(step.daysAgo),
          };
          from = step.stage;
          return event;
        });
        const notes = app.notes.map((note) => ({
          application_id: applicationId,
          actor_id: actor,
          kind: "note",
          body: note.body,
          visibility: "internal",
          created_at: at(note.daysAgo),
        }));
        return [...changes, ...notes];
      }),
    ),
    "events",
  );

  // 8. Saved jobs, one alert, and the notifications those would have produced.
  await check(
    db.from("saved_jobs").upsert(
      SEED_SAVED_JOBS.map((saved) => ({
        seeker_id: idOf(saved.seeker),
        job_id: jobOf(saved.job),
        created_at: at(3),
      })),
      { onConflict: "seeker_id,job_id" },
    ),
    "saved jobs",
  );

  const demoSeeker = required(
    SEED_SEEKER_PROFILES.find((profile) => profile.account === "demo-seeker"),
    "demo seeker profile",
  );
  const alertLabel = "Junior roles with visa sponsorship";
  const alertQuery = preferencesToQuery({
    desiredTypes: demoSeeker.desiredTypes,
    desiredWorkModes: demoSeeker.desiredWorkModes,
    experience: demoSeeker.experience,
    noProfessionalExperience: demoSeeker.noProfessionalExperience,
    needsVisaSponsorship: demoSeeker.needsVisaSponsorship,
  });
  const seekerIds = SEED_SEEKER_PROFILES.map((profile) => idOf(profile.account));
  await check(db.from("saved_searches").delete().in("seeker_id", seekerIds), "clear alerts");
  await check(
    db.from("saved_searches").insert({
      seeker_id: idOf("demo-seeker"),
      label: alertLabel,
      query: alertQuery,
      frequency: "daily",
      last_run_at: at(1),
      created_at: at(8),
    }),
    "alerts",
  );

  await check(db.from("notifications").delete().in("profile_id", seekerIds), "clear notifications");
  const alertMatches = ["tw-designer", "tw-intern"].map((key) => planOf(key));
  await check(
    db.from("notifications").insert([
      ...SEED_APPLICATIONS.flatMap((app) =>
        app.steps
          .filter((step) => step.message)
          .map((step) => ({
            profile_id: idOf(app.seeker),
            kind: "application_status",
            title: `${companyNameOfJob(app.job)} updated your application for ${planOf(app.job).title}`,
            body: step.message ?? null,
            url: "/dashboard",
            created_at: at(step.daysAgo),
            read_at: step.daysAgo > 5 ? at(step.daysAgo - 1) : null,
          })),
      ),
      {
        profile_id: idOf("demo-seeker"),
        kind: "job_alert",
        title: `${alertMatches.length} new matches for “${alertLabel}”`,
        body: alertMatches.map((job) => `${job.title} · ${companyNameOfJob(job.key)}`).join("\n"),
        url: `/jobs?${alertQuery}`,
        created_at: at(1),
        read_at: null,
      },
    ]),
    "notifications",
  );

  // 9. Two weeks of views for the demo company's live jobs, so the analytics
  //    page has a shape. Deterministic, so every reset draws the same chart.
  const viewed = SEED_JOB_PLAN.filter((job) => job.company === "tidewater" && job.status === "published");
  await check(
    db.from("job_views").upsert(
      viewed.flatMap((job, jobIndex) =>
        Array.from({ length: SEED_VIEW_DAYS }, (_, day) => ({
          job_id: jobOf(job.key),
          day: at(day).slice(0, 10),
          views: 6 + ((day * 7 + jobIndex * 13) % 11) + (day < 3 ? 6 : 0),
        })),
      ),
      { onConflict: "job_id,day" },
    ),
    "job views",
  );

  // 10. Admin access, only when an address is configured — never baked in.
  if (adminEmail) {
    await check(
      db.from("admin_emails").upsert({ email: adminEmail }, { onConflict: "email" }),
      "admin_emails",
    );
    log(`Admin access granted to ${adminEmail}`);
  }

  return {
    accounts: SEED_ACCOUNTS.length,
    companies: SEED_COMPANIES.length,
    jobs: SEED_JOB_PLAN.length,
    applications: SEED_APPLICATIONS.length,
    logins,
  };
}

/** Long, random, and covering every character class a project might require. */
function randomPassword(): string {
  return `${randomBytes(24).toString("base64url")}-Aa1`;
}

async function check(
  query: PromiseLike<{ error: { message: string } | null }>,
  label: string,
): Promise<void> {
  const { error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
}

function required<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`seed: missing ${label}`);
  return value;
}
