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

export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogoColor: string;
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
  applyUrl: string;
  postedAt: string; // ISO 8601
}

export type SortOption = "recent" | "salary" | "relevance";

export interface JobFilters {
  q?: string;
  type?: JobType[];
  mode?: WorkMode[];
  level?: ExperienceLevel[];
  minSalary?: number;
  sort?: SortOption;
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
