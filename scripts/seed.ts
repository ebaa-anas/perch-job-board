/**
 * Seed the hosted Supabase `perch` database with the bundled demo data.
 *
 * Ruling 11: one `companies` row per distinct `company` name in `SEED_JOBS`
 * (14 of them), each with a null `owner_id`, then the 14 jobs linked to their
 * company. Everything is an upsert, so the script is idempotent — safe to run
 * repeatedly.
 *
 * Run: `npm run seed`
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { SEED_JOBS } from "../src/features/jobs/seed";

config({ path: ".env.local" });

const ADMIN_EMAIL = (
  process.env.SEED_ADMIN_EMAIL ?? "ebaaanas789@gmail.com"
).toLowerCase();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — check .env.local",
  );
}

// Service role bypasses RLS, so inserts work despite the Phase-1
// public-read-only policies.
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** lowercase, non-alphanumerics → "-", trim leading/trailing "-". */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  // 1. Owner admin email (PK conflict target).
  const { error: adminErr } = await db
    .from("admin_emails")
    .upsert({ email: ADMIN_EMAIL }, { onConflict: "email" });
  if (adminErr) {
    throw new Error(`admin_emails upsert failed: ${adminErr.message}`);
  }

  // 2. One company per distinct `company` name in SEED_JOBS.
  const companyBySlug = new Map<
    string,
    {
      name: string;
      slug: string;
      tagline: null;
      description: string;
      website: null;
      owner_id: null;
      logo_color: string;
    }
  >();
  for (const job of SEED_JOBS) {
    const slug = slugify(job.company);
    if (companyBySlug.has(slug)) continue;
    companyBySlug.set(slug, {
      name: job.company,
      slug,
      tagline: null,
      description: `Open roles at ${job.company}.`,
      website: null,
      owner_id: null,
      logo_color: job.companyLogoColor,
    });
  }
  const companyRows = [...companyBySlug.values()];

  const { data: companyData, error: cErr } = await db
    .from("companies")
    .upsert(companyRows, { onConflict: "slug" })
    .select("id, slug");
  if (cErr) throw new Error(`companies upsert failed: ${cErr.message}`);

  const idBySlug = new Map<string, string>();
  for (const row of (companyData ?? []) as Array<{ id: string; slug: string }>) {
    idBySlug.set(row.slug, row.id);
  }

  // 3. The 14 jobs, each linked to its company by slug → id.
  const jobRows = SEED_JOBS.map((j) => {
    const companyId = idBySlug.get(slugify(j.company));
    if (!companyId) {
      throw new Error(
        `no company id for "${j.company}" (slug "${slugify(j.company)}")`,
      );
    }
    return {
      slug: j.id,
      company_id: companyId,
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
      apply_url: j.applyUrl ?? null,
      status: "published" as const,
      created_at: j.postedAt,
    };
  });

  const { data: jobData, error: jErr } = await db
    .from("jobs")
    .upsert(jobRows, { onConflict: "slug" })
    .select("id");
  if (jErr) throw new Error(`jobs upsert failed: ${jErr.message}`);

  const jobsUpserted = (jobData ?? []).length || jobRows.length;
  console.log(
    `Seeded ${companyRows.length} companies + ${jobsUpserted} published jobs; ` +
      `admin email ${ADMIN_EMAIL}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
