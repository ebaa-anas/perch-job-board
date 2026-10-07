import { describe, expect, it } from "vitest";

import {
  APPLICATION_STAGES,
  canTransition,
  computeResponseRate,
  isDecided,
  isTerminalStage,
  nextStages,
  seekerStatusFor,
  type ApplicationStage,
} from "@/features/applications/pipeline";

describe("APPLICATION_STAGES", () => {
  it("starts at applied and ends with the two terminal stages", () => {
    expect(APPLICATION_STAGES[0]).toBe("applied");
    expect(APPLICATION_STAGES).toContain("hired");
    expect(APPLICATION_STAGES).toContain("rejected");
  });
});

describe("isTerminalStage", () => {
  it("treats hired and rejected as terminal", () => {
    expect(isTerminalStage("hired")).toBe(true);
    expect(isTerminalStage("rejected")).toBe(true);
  });

  it("treats every in-flight stage as non-terminal", () => {
    expect(isTerminalStage("applied")).toBe(false);
    expect(isTerminalStage("reviewed")).toBe(false);
    expect(isTerminalStage("interview")).toBe(false);
    expect(isTerminalStage("offer")).toBe(false);
  });
});

describe("isDecided", () => {
  it("is false while the application is untouched", () => {
    expect(isDecided("applied")).toBe(false);
  });

  it("is true as soon as a recruiter has moved it anywhere", () => {
    expect(isDecided("reviewed")).toBe(true);
    expect(isDecided("rejected")).toBe(true);
  });
});

describe("canTransition", () => {
  it("rejects a move to the same stage", () => {
    expect(canTransition("applied", "applied")).toBe(false);
  });

  it("allows skipping straight from applied to rejected", () => {
    expect(canTransition("applied", "rejected")).toBe(true);
  });

  it("allows moving backwards, since recruiters mis-click", () => {
    expect(canTransition("interview", "reviewed")).toBe(true);
  });

  it("allows reopening a rejected application", () => {
    expect(canTransition("rejected", "shortlisted")).toBe(true);
  });

  it("refuses to move anything out of hired", () => {
    for (const stage of APPLICATION_STAGES) {
      expect(canTransition("hired", stage)).toBe(false);
    }
  });
});

describe("nextStages", () => {
  it("omits the current stage", () => {
    expect(nextStages("reviewed")).not.toContain("reviewed");
  });

  it("offers every other stage from applied", () => {
    expect(nextStages("applied")).toHaveLength(APPLICATION_STAGES.length - 1);
  });

  it("offers nothing once hired", () => {
    expect(nextStages("hired")).toEqual([]);
  });
});

describe("seekerStatusFor", () => {
  it("does not leak internal shortlisting to the candidate", () => {
    expect(seekerStatusFor("shortlisted")).toBe(seekerStatusFor("reviewed"));
  });

  it("tells the candidate plainly when they were not selected", () => {
    expect(seekerStatusFor("rejected")).toBe("not_selected");
  });

  it("surfaces the stages the candidate is party to", () => {
    expect(seekerStatusFor("applied")).toBe("submitted");
    expect(seekerStatusFor("interview")).toBe("interview");
    expect(seekerStatusFor("offer")).toBe("offer");
    expect(seekerStatusFor("hired")).toBe("hired");
  });

  it("maps every stage to a status", () => {
    for (const stage of APPLICATION_STAGES) {
      expect(seekerStatusFor(stage)).toBeTruthy();
    }
  });
});

describe("computeResponseRate", () => {
  it("is null for a company with no applications, not zero", () => {
    expect(computeResponseRate([])).toBeNull();
  });

  it("is 0 when every application was ignored", () => {
    expect(computeResponseRate(["applied", "applied"])).toBe(0);
  });

  it("is 100 when every application got a decision", () => {
    expect(computeResponseRate(["rejected", "hired"])).toBe(100);
  });

  it("rounds to a whole percentage", () => {
    const stages: ApplicationStage[] = ["applied", "applied", "applied", "rejected"];
    expect(computeResponseRate(stages)).toBe(25);
  });
});
