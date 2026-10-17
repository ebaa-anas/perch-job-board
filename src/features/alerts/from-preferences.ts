import { filtersToSearchParams } from "@/features/jobs/utils";
import type {
  ExperienceLevel,
  JobFilters,
  JobType,
  WorkMode,
} from "@/features/jobs/types";

/**
 * Turn a seeker's stated preferences into a `/jobs` query string.
 *
 * Deliberately produces a *query*, not a bespoke matching path. Saved
 * searches, the alert runner and the digest all agree that a query string
 * parsed by `parseJobFilters` is the single definition of what an alert
 * means; a preferences-aware branch inside the runner would be a second
 * definition that could silently disagree with the page the seeker is
 * looking at.
 *
 * So preferences become a pre-filled saved search, and everything already
 * built — due-checking, digests, the e-mail, `/alerts` — works unchanged.
 *
 * `desiredLocations` is intentionally not mapped: `JobFilters` has no
 * location dimension, and forcing it through the free-text `q` would match
 * job titles and descriptions as well as places, which is worse than
 * omitting it.
 */
export interface PreferenceInput {
  desiredTypes: JobType[];
  desiredWorkModes: WorkMode[];
  experience: ExperienceLevel | null;
  noProfessionalExperience: boolean | null;
  needsVisaSponsorship: boolean | null;
}

export function preferencesToQuery(input: PreferenceInput): string {
  const filters: JobFilters = {};

  if (input.desiredTypes.length > 0) filters.type = input.desiredTypes;
  if (input.desiredWorkModes.length > 0) filters.mode = input.desiredWorkModes;
  if (input.experience) filters.level = [input.experience];

  // Only ever narrows when the seeker said yes. `false` and `null` both leave
  // the filter off — someone who does not need sponsorship should still see
  // sponsoring roles, and someone who never answered must not be filtered at
  // all.
  if (input.noProfessionalExperience === true) {
    filters.noExperienceRequired = true;
  }
  if (input.needsVisaSponsorship === true) {
    filters.visaSponsorship = true;
  }

  return filtersToSearchParams(filters).toString();
}
