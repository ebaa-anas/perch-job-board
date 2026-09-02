import {
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  WORK_MODES,
  type ExperienceLevel,
  type Job,
  type JobFilters,
  type JobType,
  type SortOption,
  type WorkMode,
} from "@/features/jobs/types";

type RawSearchParams = Record<string, string | string[] | undefined>;

const SORT_OPTIONS: SortOption[] = ["relevance", "recent", "salary"];

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                 */
/* -------------------------------------------------------------------------- */

export function formatSalary(min: number, max: number, currency = "USD"): string {
  if (!min && !max) return "Salary undisclosed";
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  if (min && max && min !== max) return `${fmt.format(min)} – ${fmt.format(max)}`;
  return fmt.format(min || max);
}

export function formatSalaryCompact(
  min: number,
  max: number,
  currency = "USD",
): string {
  if (!min && !max) return "Undisclosed";
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 0,
  });
  if (min && max && min !== max) return `${fmt.format(min)}–${fmt.format(max)}`;
  return fmt.format(min || max);
}

export function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let duration = (then - Date.now()) / 1000;
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) {
      return rtf.format(Math.round(duration), unit);
    }
    duration /= amount;
  }
  return "";
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getInitials(company: string): string {
  return company
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/* -------------------------------------------------------------------------- */
/*  Search params <-> filters                                                  */
/* -------------------------------------------------------------------------- */

function toArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => v.split(","));
  if (typeof value === "string") return value.split(",");
  return [];
}

function keepKnown<T extends string>(values: string[], allowed: readonly T[]): T[] {
  const set = new Set<string>(allowed);
  return Array.from(new Set(values.map((v) => v.trim()).filter((v) => set.has(v)))) as T[];
}

export function parseJobFilters(searchParams: RawSearchParams): JobFilters {
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : undefined;

  const type = keepKnown<JobType>(toArray(searchParams.type), JOB_TYPES);
  const mode = keepKnown<WorkMode>(toArray(searchParams.mode), WORK_MODES);
  const level = keepKnown<ExperienceLevel>(
    toArray(searchParams.level),
    EXPERIENCE_LEVELS,
  );

  const rawMin = Number(
    typeof searchParams.minSalary === "string" ? searchParams.minSalary : NaN,
  );
  const minSalary =
    Number.isFinite(rawMin) && rawMin > 0 ? Math.floor(rawMin) : undefined;

  const sortCandidate =
    typeof searchParams.sort === "string" ? searchParams.sort : "";
  const sort = SORT_OPTIONS.includes(sortCandidate as SortOption)
    ? (sortCandidate as SortOption)
    : "relevance";

  return {
    q: q || undefined,
    type: type.length ? type : undefined,
    mode: mode.length ? mode : undefined,
    level: level.length ? level : undefined,
    minSalary,
    sort,
  };
}

export function filtersToSearchParams(filters: JobFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type?.length) params.set("type", filters.type.join(","));
  if (filters.mode?.length) params.set("mode", filters.mode.join(","));
  if (filters.level?.length) params.set("level", filters.level.join(","));
  if (filters.minSalary) params.set("minSalary", String(filters.minSalary));
  if (filters.sort && filters.sort !== "relevance") {
    params.set("sort", filters.sort);
  }
  return params;
}

export function countActiveFilters(filters: JobFilters): number {
  return (
    (filters.q ? 1 : 0) +
    (filters.type?.length ?? 0) +
    (filters.mode?.length ?? 0) +
    (filters.level?.length ?? 0) +
    (filters.minSalary ? 1 : 0)
  );
}

/* -------------------------------------------------------------------------- */
/*  Filtering & sorting                                                        */
/* -------------------------------------------------------------------------- */

function relevanceScore(job: Job, terms: string[]): number {
  if (!terms.length) return 0;
  const title = job.title.toLowerCase();
  const company = job.company.toLowerCase();
  const tags = job.tags.map((t) => t.toLowerCase());
  const haystack = `${title} ${company} ${job.location} ${job.description}`.toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 5;
    if (company.includes(term)) score += 3;
    if (tags.some((t) => t.includes(term))) score += 3;
    if (haystack.includes(term)) score += 1;
  }
  return score;
}

export function filterAndSortJobs(jobs: Job[], filters: JobFilters): Job[] {
  const terms =
    filters.q
      ?.toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean) ?? [];

  const filtered = jobs.filter((job) => {
    if (terms.length && relevanceScore(job, terms) === 0) return false;
    if (filters.type?.length && !filters.type.includes(job.type)) return false;
    if (filters.mode?.length && !filters.mode.includes(job.workMode)) return false;
    if (filters.level?.length && !filters.level.includes(job.experience)) {
      return false;
    }
    if (filters.minSalary && job.salaryMax < filters.minSalary) return false;
    return true;
  });

  const byRecent = (a: Job, b: Job) =>
    new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();

  switch (filters.sort) {
    case "recent":
      return filtered.sort(byRecent);
    case "salary":
      return filtered.sort(
        (a, b) => b.salaryMax - a.salaryMax || byRecent(a, b),
      );
    default:
      if (!terms.length) return filtered.sort(byRecent);
      return filtered.sort(
        (a, b) =>
          relevanceScore(b, terms) - relevanceScore(a, terms) || byRecent(a, b),
      );
  }
}
