import { describe, expect, it } from "vitest";

import { matchSignals } from "@/features/matching/signals";

describe("matchSignals", () => {
  const job = {
    experience: "mid" as const,
    visaSponsorship: false,
    noExperienceRequired: false,
  };

  it("reports nothing when the seeker has said nothing", () => {
    // The rule that matters most: a blank profile is never penalised, it is
    // simply not compared.
    const signals = matchSignals(job, {
      experience: null,
      noProfessionalExperience: null,
      needsVisaSponsorship: null,
    });
    expect(signals).toEqual([]);
  });

  it("confirms a matching experience level", () => {
    const signals = matchSignals(job, {
      experience: "mid",
      noProfessionalExperience: null,
      needsVisaSponsorship: null,
    });
    expect(signals).toEqual([{ id: "experience", tone: "match" }]);
  });

  it("flags a mismatched experience level without calling it a failure", () => {
    const signals = matchSignals(job, {
      experience: "lead",
      noProfessionalExperience: null,
      needsVisaSponsorship: null,
    });
    expect(signals).toEqual([{ id: "experience", tone: "differs" }]);
  });

  it("treats an entry-level job as a match for someone with no experience", () => {
    const signals = matchSignals(
      { ...job, noExperienceRequired: true },
      {
        experience: null,
        noProfessionalExperience: true,
        needsVisaSponsorship: null,
      },
    );
    expect(signals).toContainEqual({ id: "entryLevel", tone: "match" });
  });

  it("does not claim an entry-level match when the job is not entry level", () => {
    const signals = matchSignals(job, {
      experience: null,
      noProfessionalExperience: true,
      needsVisaSponsorship: null,
    });
    expect(signals.map((s) => s.id)).not.toContain("entryLevel");
  });

  it("confirms sponsorship when the seeker needs it and the job offers it", () => {
    const signals = matchSignals(
      { ...job, visaSponsorship: true },
      {
        experience: null,
        noProfessionalExperience: null,
        needsVisaSponsorship: true,
      },
    );
    expect(signals).toEqual([{ id: "sponsorship", tone: "match" }]);
  });

  it("warns when the seeker needs sponsorship and the job does not offer it", () => {
    const signals = matchSignals(job, {
      experience: null,
      noProfessionalExperience: null,
      needsVisaSponsorship: true,
    });
    expect(signals).toEqual([{ id: "sponsorship", tone: "blocker" }]);
  });

  it("says nothing about sponsorship when the seeker does not need it", () => {
    // Not a selling point — most roles not needing sponsorship is the norm.
    const signals = matchSignals(
      { ...job, visaSponsorship: true },
      {
        experience: null,
        noProfessionalExperience: null,
        needsVisaSponsorship: false,
      },
    );
    expect(signals.map((s) => s.id)).not.toContain("sponsorship");
  });

  it("reports several signals together", () => {
    const signals = matchSignals(
      { experience: "junior", visaSponsorship: true, noExperienceRequired: true },
      {
        experience: "junior",
        noProfessionalExperience: true,
        needsVisaSponsorship: true,
      },
    );
    expect(signals.map((s) => s.id).sort()).toEqual([
      "entryLevel",
      "experience",
      "sponsorship",
    ]);
  });

  it("never reports a blocker that the seeker did not cause", () => {
    // A job without sponsorship plus a seeker who never answered must stay
    // silent rather than guessing they are ineligible.
    const signals = matchSignals(job, {
      experience: null,
      noProfessionalExperience: null,
      needsVisaSponsorship: null,
    });
    expect(signals.some((s) => s.tone === "blocker")).toBe(false);
  });
});
