/**
 * The company team permission model.
 *
 * Pure, with no server-only imports, so the capability table is testable on
 * its own. This mirrors — and never replaces — the SQL side: `owns_job()`,
 * `owns_company()` and `can_manage_company()` in migration 0018 are the
 * security boundary. What lives here decides which controls to render and
 * which actions to refuse early with a readable message.
 */

export const TEAM_ROLES = ["owner", "admin", "recruiter"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/**
 * Roles that can be granted. `owner` is deliberately absent: it tracks
 * `companies.owner_id`, there is exactly one, and it changes only by an
 * explicit ownership transfer — never by picking it from a dropdown.
 */
export const ASSIGNABLE_TEAM_ROLES = ["admin", "recruiter"] as const;
export type AssignableTeamRole = (typeof ASSIGNABLE_TEAM_ROLES)[number];

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  recruiter: "Recruiter",
};

export const TEAM_ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  owner: "Full control, including billing, ownership and deleting the company.",
  admin: "Can edit the company profile and manage the team.",
  recruiter: "Can post jobs and work with applicants.",
};

export const TEAM_CAPABILITIES = [
  "post_jobs",
  "manage_applicants",
  "edit_company",
  "manage_team",
  "delete_company",
  "transfer_ownership",
] as const;
export type TeamCapability = (typeof TEAM_CAPABILITIES)[number];

/**
 * Capability table, least privilege first.
 *
 * Every member can do the hiring work — that is the point of a seat. What
 * escalates is authority over the company itself: its public profile, who else
 * holds a seat, and whether it continues to exist.
 */
const CAPABILITIES: Record<TeamRole, readonly TeamCapability[]> = {
  recruiter: ["post_jobs", "manage_applicants"],
  admin: ["post_jobs", "manage_applicants", "edit_company", "manage_team"],
  owner: [
    "post_jobs",
    "manage_applicants",
    "edit_company",
    "manage_team",
    "delete_company",
    "transfer_ownership",
  ],
};

export function isTeamRole(value: unknown): value is TeamRole {
  return (
    typeof value === "string" && (TEAM_ROLES as readonly string[]).includes(value)
  );
}

export function isAssignableTeamRole(value: unknown): value is AssignableTeamRole {
  return (
    typeof value === "string" &&
    (ASSIGNABLE_TEAM_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Whether `role` carries `capability`. A null role — no membership — is denied
 * everything, and an unrecognised role falls through to denial rather than
 * defaulting open.
 */
export function can(
  role: TeamRole | null | undefined,
  capability: TeamCapability,
): boolean {
  if (!isTeamRole(role)) return false;
  return CAPABILITIES[role].includes(capability);
}
