import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/features/auth/session";
import {
  DEFAULT_STAGE,
  isApplicationStage,
  seekerStatusFor,
  type ApplicationStage,
  type SeekerStatus,
} from "@/features/applications/pipeline";

export type ApplyVia = "onsite" | "external";

export interface MyApplication {
  id: string;
  note: string | null;
  via: ApplyVia;
  createdAt: string;
  /** What the candidate is told. Deliberately coarser than the internal stage. */
  status: SeekerStatus;
  /** When the employer first responded, or null while still unanswered. */
  decidedAt: string | null;
  job: {
    id: string;
    slug: string;
    title: string;
    status: "published" | "draft" | "closed";
    company: { name: string; slug: string };
  };
}

export interface ApplicationAnswer {
  questionId: string;
  label: string;
  type: "short_text" | "long_text" | "yes_no" | "multiple_choice";
  answer: string | boolean;
}

export interface JobApplicant {
  id: string;
  note: string | null;
  via: ApplyVia;
  createdAt: string;
  cvFilename: string | null;
  hasCv: boolean;
  customAnswers: ApplicationAnswer[];
  /** Internal pipeline stage — recruiter-side only. */
  stage: ApplicationStage;
  rating: number | null;
  seeker: {
    id: string;
    fullName: string | null;
    headline: string | null;
    location: string | null;
    bio: string | null;
    skills: string[];
    portfolioUrl: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
  };
}

export interface ApplicationEvent {
  id: string;
  kind: "stage_change" | "note";
  fromStage: ApplicationStage | null;
  toStage: ApplicationStage | null;
  body: string | null;
  visibility: "internal" | "seeker";
  createdAt: string;
}

/** A row shape shared by every query that embeds the pipeline. */
type PipelineEmbed = { stage: string; rating: number | null; decided_at: string | null } | null;

function stageFrom(embed: PipelineEmbed): ApplicationStage {
  // `application_pipeline` is trigger-created, so a missing row means the
  // migration has not been applied yet; treat that as a fresh application
  // rather than throwing on a page a recruiter is trying to read.
  return isApplicationStage(embed?.stage) ? embed.stage : DEFAULT_STAGE;
}

/** { jobId -> applicant count } across all of the recruiter's jobs. RLS scopes
 *  `applications` SELECT to jobs the caller owns, so this needs no id list. */
export const getApplicantCountsForOwner = cache(
  async (): Promise<Record<string, number>> => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("applications").select("job_id");
    if (error) return {};
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const id = (row as { job_id: string }).job_id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  },
);

/** Has the signed-in seeker already applied to this job? */
export const hasApplied = cache(async (jobId: string): Promise<boolean> => {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("seeker_id", user.id);
  return (count ?? 0) > 0;
});

/** The signed-in seeker's application to this job, if any (for the apply CTA). */
export const getApplyRecord = cache(
  async (jobId: string): Promise<{ via: ApplyVia } | null> => {
    const user = await getUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("applications")
      .select("via")
      .eq("job_id", jobId)
      .eq("seeker_id", user.id)
      .maybeSingle();
    return data ? { via: (data.via as ApplyVia) ?? "onsite" } : null;
  },
);

/** The signed-in seeker's applications, newest first, with job + company. */
export const getMyApplications = cache(async (): Promise<MyApplication[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, note, via, created_at, application_pipeline ( stage, rating, decided_at ), " +
        "jobs!inner ( id, slug, title, status, companies!inner ( name, slug ) )",
    )
    .eq("seeker_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getMyApplications: ${error.message}`);

  type Row = {
    id: string;
    note: string | null;
    via: string | null;
    created_at: string;
    application_pipeline: PipelineEmbed;
    jobs: {
      id: string;
      slug: string;
      title: string;
      status: MyApplication["job"]["status"];
      companies: { name: string; slug: string };
    };
  };

  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    note: row.note,
    via: (row.via as ApplyVia) ?? "onsite",
    createdAt: row.created_at,
    status: seekerStatusFor(stageFrom(row.application_pipeline)),
    decidedAt: row.application_pipeline?.decided_at ?? null,
    job: {
      id: row.jobs.id,
      slug: row.jobs.slug,
      title: row.jobs.title,
      status: row.jobs.status,
      company: {
        name: row.jobs.companies.name,
        slug: row.jobs.companies.slug,
      },
    },
  }));
});

/**
 * Applicants for a job the signed-in recruiter owns. RLS returns rows only when
 * `owns_job(job_id)` (or admin), so an unauthorised caller just gets [].
 */
export const getJobApplicants = cache(
  async (jobId: string): Promise<JobApplicant[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("applications")
      .select(
        "id, note, via, created_at, cv_path, cv_filename, seeker_id, custom_answers, " +
          "application_pipeline ( stage, rating, decided_at ), " +
          "profiles ( full_name, seeker_profiles ( headline, location, bio, skills, portfolio_url, linkedin_url, github_url ) )",
      )
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`getJobApplicants: ${error.message}`);

    type Row = {
      id: string;
      note: string | null;
      via: string | null;
      created_at: string;
      cv_path: string | null;
      cv_filename: string | null;
      seeker_id: string;
      custom_answers: unknown;
      application_pipeline: PipelineEmbed;
      profiles: {
        full_name: string | null;
        seeker_profiles: {
          headline: string | null;
          location: string | null;
          bio: string | null;
          skills: string[] | null;
          portfolio_url: string | null;
          linkedin_url: string | null;
          github_url: string | null;
        } | null;
      } | null;
    };

    return (data as unknown as Row[]).map((row) => {
      const sp = row.profiles?.seeker_profiles ?? null;
      return {
        id: row.id,
        note: row.note,
        via: (row.via as ApplyVia) ?? "onsite",
        createdAt: row.created_at,
        cvFilename: row.cv_filename,
        hasCv: Boolean(row.cv_path),
        customAnswers: Array.isArray(row.custom_answers)
          ? (row.custom_answers as ApplicationAnswer[])
          : [],
        stage: stageFrom(row.application_pipeline),
        rating: row.application_pipeline?.rating ?? null,
        seeker: {
          id: row.seeker_id,
          fullName: row.profiles?.full_name ?? null,
          headline: sp?.headline ?? null,
          location: sp?.location ?? null,
          bio: sp?.bio ?? null,
          skills: sp?.skills ?? [],
          portfolioUrl: sp?.portfolio_url ?? null,
          linkedinUrl: sp?.linkedin_url ?? null,
          githubUrl: sp?.github_url ?? null,
        },
      };
    });
  },
);

/**
 * Every event for every application on one job, grouped by application id.
 *
 * One query rather than one per applicant: the recruiter's drawer opens on an
 * arbitrary row, so the alternative is either an N+1 on page load or a
 * round-trip on every click. RLS already scopes `application_events` to jobs
 * the caller owns, and the `applications!inner` filter narrows it to this job.
 */
export const getJobApplicationEvents = cache(
  async (jobId: string): Promise<Record<string, ApplicationEvent[]>> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("application_events")
      .select(
        "id, application_id, kind, from_stage, to_stage, body, visibility, created_at, " +
          "applications!inner ( job_id )",
      )
      .eq("applications.job_id", jobId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getJobApplicationEvents]", error);
      return {};
    }

    type Row = {
      id: string;
      application_id: string;
      kind: string;
      from_stage: string | null;
      to_stage: string | null;
      body: string | null;
      visibility: string;
      created_at: string;
    };

    const grouped: Record<string, ApplicationEvent[]> = {};
    for (const row of (data as unknown as Row[]) ?? []) {
      (grouped[row.application_id] ??= []).push({
        id: row.id,
        kind: row.kind as ApplicationEvent["kind"],
        fromStage: isApplicationStage(row.from_stage) ? row.from_stage : null,
        toStage: isApplicationStage(row.to_stage) ? row.to_stage : null,
        body: row.body,
        visibility: row.visibility as ApplicationEvent["visibility"],
        createdAt: row.created_at,
      });
    }
    return grouped;
  },
);

/**
 * How often a company responds to the people who apply to it, 0–100, or null
 * when there is nothing to judge yet.
 *
 * Read over the service-role client against the `company_response_rates` view,
 * because the page that shows it is public and `application_pipeline` is not:
 * only the two aggregate counts leave the database, never a row about a person.
 */
export const getCompanyResponseRate = cache(
  async (
    companyId: string,
  ): Promise<{ rate: number; total: number } | null> => {
    const { data, error } = await createAdminClient()
      .from("company_response_rates")
      .select("total_applications, responded_applications")
      .eq("company_id", companyId)
      .maybeSingle();

    if (error || !data) return null;
    const total = Number(data.total_applications ?? 0);
    if (total === 0) return null;
    const responded = Number(data.responded_applications ?? 0);
    return { rate: Math.round((responded / total) * 100), total };
  },
);
