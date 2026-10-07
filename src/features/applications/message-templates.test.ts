import { describe, expect, it } from "vitest";

import {
  fillTemplate,
  templatesForStage,
} from "@/features/applications/message-templates";
import { APPLICATION_STAGES } from "@/features/applications/pipeline";

describe("templatesForStage", () => {
  it("offers wording for a rejection, the message recruiters most avoid writing", () => {
    expect(templatesForStage("rejected").length).toBeGreaterThan(0);
  });

  it("offers wording for an interview invitation", () => {
    expect(templatesForStage("interview").length).toBeGreaterThan(0);
  });

  it("offers nothing for stages the candidate is not told about in words", () => {
    expect(templatesForStage("applied")).toEqual([]);
  });

  it("never throws for any stage", () => {
    for (const stage of APPLICATION_STAGES) {
      expect(Array.isArray(templatesForStage(stage))).toBe(true);
    }
  });

  it("gives every template a distinct id and a label", () => {
    const ids = APPLICATION_STAGES.flatMap((stage) =>
      templatesForStage(stage).map((t) => t.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
    for (const stage of APPLICATION_STAGES) {
      for (const template of templatesForStage(stage)) {
        expect(template.label.length).toBeGreaterThan(0);
        expect(template.body.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("fillTemplate", () => {
  it("substitutes the role and company", () => {
    const filled = fillTemplate("Thanks for applying to {role} at {company}.", {
      role: "Frontend Engineer",
      company: "Acme",
    });
    expect(filled).toBe("Thanks for applying to Frontend Engineer at Acme.");
  });

  it("replaces every occurrence, not just the first", () => {
    expect(fillTemplate("{company} — {company}", { role: "R", company: "Acme" })).toBe(
      "Acme — Acme",
    );
  });

  it("leaves unknown placeholders untouched rather than printing undefined", () => {
    expect(fillTemplate("Hi {name}", { role: "R", company: "C" })).toBe("Hi {name}");
  });

  it("does not let a company name containing a placeholder re-expand", () => {
    const filled = fillTemplate("{company} at {role}", {
      role: "Engineer",
      company: "{role}",
    });
    expect(filled).toBe("{role} at Engineer");
  });
});
