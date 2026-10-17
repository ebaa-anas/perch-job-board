import {
  EXPERIENCE_LABELS,
  JOB_TYPE_LABELS,
  WORK_MODE_LABELS,
  type JobFilters,
} from "@/features/jobs/types";

/** `saved_searches.label` is text(80)-ish by convention; keep suggestions inside it. */
const MAX_LABEL = 80;

/**
 * A human name for a filter set, used to pre-fill the alert label.
 *
 * `sort` is excluded deliberately: it reorders results but changes nothing
 * about which jobs match, so including it would produce two differently-named
 * alerts for the same search.
 */
export function describeFilters(filters: JobFilters): string {
  const qualifiers = [
    filters.mode?.map((mode) => WORK_MODE_LABELS[mode]).join(", "),
    filters.level?.map((level) => EXPERIENCE_LABELS[level]).join(", "),
    filters.type?.map((type) => JOB_TYPE_LABELS[type]).join(", "),
  ].filter(Boolean) as string[];

  const suffixes: string[] = [];
  if (filters.minSalary) {
    suffixes.push(`over ${filters.minSalary.toLocaleString("en-US")}`);
  }
  if (filters.visaSponsorship) suffixes.push("with visa sponsorship");
  if (filters.noExperienceRequired) suffixes.push("needing no experience");

  const term = filters.q ? `“${filters.q}”` : "";

  const head = [...qualifiers, term].filter(Boolean).join(" ");
  const label = head
    ? [`${head} jobs`, ...suffixes].join(" ")
    : ["All jobs", ...suffixes].join(" ");

  // A quoted search term can be arbitrarily long; truncate rather than let the
  // insert fail on a column limit the seeker never sees.
  const normalised = label.replace(/\s+/g, " ").trim();
  if (normalised.length <= MAX_LABEL) return normalised;
  return `${normalised.slice(0, MAX_LABEL - 1).trimEnd()}…`;
}
