import { describe, expect, it } from "vitest";

import {
  ASSIGNABLE_TEAM_ROLES,
  TEAM_CAPABILITIES,
  TEAM_ROLES,
  can,
  isAssignableTeamRole,
  isTeamRole,
  type TeamCapability,
  type TeamRole,
} from "@/features/team/roles";

describe("TEAM_ROLES", () => {
  it("has owner, admin and recruiter", () => {
    expect(TEAM_ROLES).toEqual(["owner", "admin", "recruiter"]);
  });

  it("never lets owner be handed out by invitation or role change", () => {
    expect(ASSIGNABLE_TEAM_ROLES).not.toContain("owner");
    expect(isAssignableTeamRole("owner")).toBe(false);
    expect(isAssignableTeamRole("admin")).toBe(true);
    expect(isAssignableTeamRole("recruiter")).toBe(true);
  });
});

describe("isTeamRole", () => {
  it("accepts the three roles and rejects anything else", () => {
    expect(isTeamRole("owner")).toBe(true);
    expect(isTeamRole("seeker")).toBe(false);
    expect(isTeamRole(null)).toBe(false);
    expect(isTeamRole(undefined)).toBe(false);
    expect(isTeamRole(7)).toBe(false);
  });
});

describe("can", () => {
  it("lets every member do the hiring work", () => {
    for (const role of TEAM_ROLES) {
      expect(can(role, "post_jobs"), role).toBe(true);
      expect(can(role, "manage_applicants"), role).toBe(true);
    }
  });

  it("keeps the company profile out of a plain recruiter's hands", () => {
    expect(can("recruiter", "edit_company")).toBe(false);
    expect(can("admin", "edit_company")).toBe(true);
    expect(can("owner", "edit_company")).toBe(true);
  });

  it("keeps team management to owner and admin", () => {
    expect(can("recruiter", "manage_team")).toBe(false);
    expect(can("admin", "manage_team")).toBe(true);
    expect(can("owner", "manage_team")).toBe(true);
  });

  it("reserves deleting the company and transferring it to the owner alone", () => {
    for (const capability of ["delete_company", "transfer_ownership"] as const) {
      expect(can("owner", capability), capability).toBe(true);
      expect(can("admin", capability), capability).toBe(false);
      expect(can("recruiter", capability), capability).toBe(false);
    }
  });

  it("answers for every role and capability pair", () => {
    for (const role of TEAM_ROLES) {
      for (const capability of TEAM_CAPABILITIES) {
        expect(typeof can(role, capability)).toBe("boolean");
      }
    }
  });

  it("is monotonic: an admin can do everything a recruiter can", () => {
    for (const capability of TEAM_CAPABILITIES) {
      if (can("recruiter", capability)) {
        expect(can("admin", capability), capability).toBe(true);
      }
    }
  });

  it("is monotonic: an owner can do everything an admin can", () => {
    for (const capability of TEAM_CAPABILITIES) {
      if (can("admin", capability)) {
        expect(can("owner", capability), capability).toBe(true);
      }
    }
  });

  it("denies when the caller has no membership at all", () => {
    const capabilities: TeamCapability[] = [...TEAM_CAPABILITIES];
    for (const capability of capabilities) {
      expect(can(null, capability), capability).toBe(false);
    }
  });

  it("denies an unrecognised role rather than defaulting open", () => {
    expect(can("superuser" as TeamRole, "manage_team")).toBe(false);
  });
});
