import { describe, expect, it } from "vitest";

import {
  computeJobFunnel,
  medianHours,
  percentage,
  type FunnelApplication,
} from "@/features/analytics/funnel";

function app(overrides: Partial<FunnelApplication> = {}): FunnelApplication {
  return {
    createdAt: "2026-03-01T00:00:00.000Z",
    stage: "applied",
    decidedAt: null,
    ...overrides,
  };
}

describe("percentage", () => {
  it("is null when there is nothing to divide by, not zero", () => {
    expect(percentage(0, 0)).toBeNull();
  });

  it("rounds to a whole number", () => {
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(2, 3)).toBe(67);
  });

  it("handles the full and empty cases", () => {
    expect(percentage(0, 4)).toBe(0);
    expect(percentage(4, 4)).toBe(100);
  });

  it("does not cap above 100, so a bad ratio stays visible", () => {
    expect(percentage(5, 4)).toBe(125);
  });
});

describe("medianHours", () => {
  it("is null with no samples", () => {
    expect(medianHours([])).toBeNull();
  });

  it("is the middle value for an odd count", () => {
    expect(medianHours([1, 10, 3])).toBe(3);
  });

  it("averages the two middle values for an even count", () => {
    expect(medianHours([2, 4, 6, 8])).toBe(5);
  });

  it("is a median, not a mean, so one outlier does not distort it", () => {
    expect(medianHours([1, 2, 3, 4, 1000])).toBe(3);
  });

  it("rounds to one decimal place", () => {
    expect(medianHours([1, 2])).toBe(1.5);
    expect(medianHours([1, 2, 2.26])).toBe(2);
  });
});

describe("computeJobFunnel", () => {
  it("reports an empty job without dividing by zero", () => {
    const funnel = computeJobFunnel({ views: 0, applications: [] });
    expect(funnel.views).toBe(0);
    expect(funnel.applications).toBe(0);
    expect(funnel.applyRate).toBeNull();
    expect(funnel.responseRate).toBeNull();
    expect(funnel.medianHoursToFirstResponse).toBeNull();
  });

  it("computes the view-to-application rate", () => {
    const funnel = computeJobFunnel({ views: 200, applications: [app(), app()] });
    expect(funnel.applyRate).toBe(1);
  });

  it("leaves the apply rate null when views are not yet recorded", () => {
    // An application without a recorded view is possible (the visitor had no
    // JavaScript); reporting an infinite rate would be worse than reporting none.
    const funnel = computeJobFunnel({ views: 0, applications: [app()] });
    expect(funnel.applyRate).toBeNull();
  });

  it("counts a stage breakdown", () => {
    const funnel = computeJobFunnel({
      views: 10,
      applications: [
        app({ stage: "applied" }),
        app({ stage: "applied" }),
        app({ stage: "rejected" }),
        app({ stage: "hired" }),
      ],
    });
    expect(funnel.stageCounts.applied).toBe(2);
    expect(funnel.stageCounts.rejected).toBe(1);
    expect(funnel.stageCounts.hired).toBe(1);
    expect(funnel.stageCounts.interview).toBe(0);
  });

  it("treats anything past applied as a response", () => {
    const funnel = computeJobFunnel({
      views: 10,
      applications: [app({ stage: "applied" }), app({ stage: "reviewed" })],
    });
    expect(funnel.responded).toBe(1);
    expect(funnel.awaiting).toBe(1);
    expect(funnel.responseRate).toBe(50);
  });

  it("measures time to first response in hours", () => {
    const funnel = computeJobFunnel({
      views: 1,
      applications: [
        app({
          createdAt: "2026-03-01T00:00:00.000Z",
          stage: "reviewed",
          decidedAt: "2026-03-01T12:00:00.000Z",
        }),
      ],
    });
    expect(funnel.medianHoursToFirstResponse).toBe(12);
  });

  it("ignores applications still awaiting a response in the median", () => {
    const funnel = computeJobFunnel({
      views: 1,
      applications: [
        app({
          createdAt: "2026-03-01T00:00:00.000Z",
          stage: "reviewed",
          decidedAt: "2026-03-01T04:00:00.000Z",
        }),
        app({ stage: "applied", decidedAt: null }),
      ],
    });
    expect(funnel.medianHoursToFirstResponse).toBe(4);
  });

  it("ignores a decidedAt that precedes the application", () => {
    // Clock skew or a hand-edited row should not produce a negative duration.
    const funnel = computeJobFunnel({
      views: 1,
      applications: [
        app({
          createdAt: "2026-03-02T00:00:00.000Z",
          stage: "reviewed",
          decidedAt: "2026-03-01T00:00:00.000Z",
        }),
      ],
    });
    expect(funnel.medianHoursToFirstResponse).toBeNull();
  });

  it("ignores an unparseable timestamp rather than producing NaN", () => {
    const funnel = computeJobFunnel({
      views: 1,
      applications: [app({ stage: "reviewed", decidedAt: "nonsense" })],
    });
    expect(funnel.medianHoursToFirstResponse).toBeNull();
  });
});
