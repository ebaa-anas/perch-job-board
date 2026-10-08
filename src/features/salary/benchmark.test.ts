import { describe, expect, it } from "vitest";

import {
  MIN_BENCHMARK_SAMPLE,
  compareToBenchmark,
  computeBenchmark,
  midpoint,
  percentile,
} from "@/features/salary/benchmark";

describe("midpoint", () => {
  it("averages the range", () => {
    expect(midpoint({ salaryMin: 40000, salaryMax: 60000 })).toBe(50000);
  });

  it("handles an exact figure given as both ends", () => {
    expect(midpoint({ salaryMin: 50000, salaryMax: 50000 })).toBe(50000);
  });
});

describe("percentile", () => {
  const sorted = [10, 20, 30, 40, 50];

  it("returns the median at p50", () => {
    expect(percentile(sorted, 50)).toBe(30);
  });

  it("returns the bounds at p0 and p100", () => {
    expect(percentile(sorted, 0)).toBe(10);
    expect(percentile(sorted, 100)).toBe(50);
  });

  it("interpolates between ranks", () => {
    // p25 of [10,20,30,40,50] sits at index 1.0 exactly → 20.
    expect(percentile(sorted, 25)).toBe(20);
    // p60 sits at index 2.4 → 30 + 0.4 * (40 - 30).
    expect(percentile(sorted, 60)).toBe(34);
  });

  it("interpolates on an even-length set", () => {
    expect(percentile([10, 20], 50)).toBe(15);
  });

  it("is null for an empty set", () => {
    expect(percentile([], 50)).toBeNull();
  });

  it("handles a single value", () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 10)).toBe(42);
  });
});

/* -------------------------------------------------------------------------- */

interface Row {
  salaryMin: number;
  salaryMax: number;
  currency: string;
  experience: "junior" | "mid" | "senior" | "lead";
  location: string;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    salaryMin: 40000,
    salaryMax: 60000,
    currency: "USD",
    experience: "mid",
    location: "Istanbul",
    ...overrides,
  };
}

/** Enough distinct rows to clear the privacy threshold. */
function sample(n: number, overrides: Partial<Row> = {}): Row[] {
  return Array.from({ length: n }, (_, i) =>
    row({ salaryMin: 10000 * (i + 1), salaryMax: 10000 * (i + 1), ...overrides }),
  );
}

describe("computeBenchmark", () => {
  it("is null with no data", () => {
    expect(computeBenchmark([], { currency: "USD", experience: "mid" })).toBeNull();
  });

  it("is null below the sample threshold, so one employer cannot be identified", () => {
    const rows = sample(MIN_BENCHMARK_SAMPLE - 1);
    expect(computeBenchmark(rows, { currency: "USD", experience: "mid" })).toBeNull();
  });

  it("reports once the threshold is met", () => {
    const rows = sample(MIN_BENCHMARK_SAMPLE);
    const result = computeBenchmark(rows, { currency: "USD", experience: "mid" });
    expect(result?.count).toBe(MIN_BENCHMARK_SAMPLE);
    expect(result?.currency).toBe("USD");
  });

  it("reports the quartiles and the median", () => {
    // Ten points (10k..100k) so the privacy threshold is met. With indices
    // 0..9 the inclusive convention puts p25 at index 2.25, p50 at 4.5 and
    // p75 at 6.75, interpolating between the neighbouring values.
    const rows = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((k) =>
      row({ salaryMin: k * 1000, salaryMax: k * 1000 }),
    );
    const result = computeBenchmark(rows, { currency: "USD", experience: "mid" });
    expect(result?.count).toBe(10);
    expect(result?.p25).toBe(32500);
    expect(result?.p50).toBe(55000);
    expect(result?.p75).toBe(77500);
  });

  it("excludes jobs that did not disclose a salary", () => {
    const rows = [
      ...sample(MIN_BENCHMARK_SAMPLE),
      row({ salaryMin: 0, salaryMax: 0 }),
      row({ salaryMin: 0, salaryMax: 0 }),
    ];
    const result = computeBenchmark(rows, { currency: "USD", experience: "mid" });
    expect(result?.count).toBe(MIN_BENCHMARK_SAMPLE);
  });

  it("never mixes currencies", () => {
    const rows = [
      ...sample(MIN_BENCHMARK_SAMPLE),
      ...sample(MIN_BENCHMARK_SAMPLE, { currency: "TRY" }),
    ];
    const result = computeBenchmark(rows, { currency: "USD", experience: "mid" });
    expect(result?.count).toBe(MIN_BENCHMARK_SAMPLE);
  });

  it("filters by experience level", () => {
    const rows = [
      ...sample(MIN_BENCHMARK_SAMPLE),
      ...sample(MIN_BENCHMARK_SAMPLE, { experience: "senior" }),
    ];
    const result = computeBenchmark(rows, { currency: "USD", experience: "senior" });
    expect(result?.count).toBe(MIN_BENCHMARK_SAMPLE);
    expect(result?.experience).toBe("senior");
  });

  it("filters by location when one is given, case-insensitively", () => {
    const rows = [
      ...sample(MIN_BENCHMARK_SAMPLE, { location: "Istanbul" }),
      ...sample(MIN_BENCHMARK_SAMPLE, { location: "Ankara" }),
    ];
    const result = computeBenchmark(rows, {
      currency: "USD",
      experience: "mid",
      location: "  istanbul ",
    });
    expect(result?.count).toBe(MIN_BENCHMARK_SAMPLE);
    expect(result?.location).toBe("Istanbul");
  });

  it("ignores location when not given", () => {
    const rows = [
      ...sample(MIN_BENCHMARK_SAMPLE, { location: "Istanbul" }),
      ...sample(MIN_BENCHMARK_SAMPLE, { location: "Ankara" }),
    ];
    const result = computeBenchmark(rows, { currency: "USD", experience: "mid" });
    expect(result?.count).toBe(MIN_BENCHMARK_SAMPLE * 2);
    expect(result?.location).toBeNull();
  });
});

describe("compareToBenchmark", () => {
  const benchmark = {
    count: 10,
    currency: "USD",
    experience: "mid" as const,
    location: null,
    p25: 40000,
    p50: 50000,
    p75: 60000,
  };

  it("calls a figure at the median 'at market'", () => {
    const result = compareToBenchmark(50000, benchmark);
    expect(result.verdict).toBe("at");
    expect(result.deltaPercent).toBe(0);
  });

  it("treats a small difference as at market rather than precision theatre", () => {
    expect(compareToBenchmark(51000, benchmark).verdict).toBe("at");
    expect(compareToBenchmark(49000, benchmark).verdict).toBe("at");
  });

  it("reports a figure clearly under the median as below", () => {
    const result = compareToBenchmark(40000, benchmark);
    expect(result.verdict).toBe("below");
    expect(result.deltaPercent).toBe(-20);
  });

  it("reports a figure clearly over the median as above", () => {
    const result = compareToBenchmark(60000, benchmark);
    expect(result.verdict).toBe("above");
    expect(result.deltaPercent).toBe(20);
  });

  it("rounds the delta to a whole percentage", () => {
    expect(compareToBenchmark(53333, benchmark).deltaPercent).toBe(7);
  });
});
