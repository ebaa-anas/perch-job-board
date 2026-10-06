export const JOB_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "internship",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const WORK_MODES = ["remote", "hybrid", "on-site"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const EXPERIENCE_LEVELS = ["junior", "mid", "senior", "lead"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const CONTENT_LANGUAGES = ["en", "tr"] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];

/** Always the language's own name — shown regardless of the site's UI locale. */
export const LANGUAGE_LABELS: Record<ContentLanguage, string> = {
  en: "English",
  tr: "Türkçe",
};

export interface JobCompany {
  name: string;
  slug: string;
  logoColor: string;
  logoPath: string | null;
}

export interface Job {
  id: string;
  slug: string;
  companyId: string;
  company: JobCompany;
  title: string;
  location: string;
  type: JobType;
  workMode: WorkMode;
  experience: ExperienceLevel;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  perks: string[];
  tags: string[];
  status: "published" | "draft" | "closed";
  postedAt: string; // ISO 8601
  noExperienceRequired: boolean;
  visaSponsorship: boolean;
  language: ContentLanguage;
}

export type SortOption = "recent" | "salary" | "relevance";

export interface JobFilters {
  q?: string;
  type?: JobType[];
  mode?: WorkMode[];
  level?: ExperienceLevel[];
  minSalary?: number;
  sort?: SortOption;
  noExperienceRequired?: boolean;
  visaSponsorship?: boolean;
  language?: ContentLanguage;
}

/** Human-readable labels for the enum-ish values. */
export const JOB_TYPE_LABELS: Record<JobType, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  internship: "Internship",
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  "on-site": "On-site",
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead",
};

/* -------------------------------------------------------------------------- */
/*  Per-job custom application questions                                       */
/* -------------------------------------------------------------------------- */

export const APPLICATION_QUESTION_TYPES = [
  "short_text",
  "long_text",
  "yes_no",
  "multiple_choice",
] as const;
export type ApplicationQuestionType = (typeof APPLICATION_QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<ApplicationQuestionType, string> = {
  short_text: "Short answer",
  long_text: "Long answer",
  yes_no: "Yes / No",
  multiple_choice: "Multiple choice",
};

export const MAX_APPLICATION_QUESTIONS = 6;

export interface JobApplicationQuestion {
  id: string;
  label: string;
  type: ApplicationQuestionType;
  required: boolean;
  /** Only meaningful for `multiple_choice`. */
  options: string[];
}
