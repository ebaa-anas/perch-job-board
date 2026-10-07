import { describe, expect, it } from "vitest";

import { findKnockout, knockoutLabel } from "@/features/applications/knockout";
import type { JobApplicationQuestion } from "@/features/jobs/types";

function question(
  overrides: Partial<JobApplicationQuestion> = {},
): JobApplicationQuestion {
  return {
    id: "q1",
    label: "Do you have the right to work in Türkiye?",
    type: "yes_no",
    required: true,
    options: [],
    knockoutAnswer: null,
    ...overrides,
  };
}

describe("findKnockout", () => {
  it("passes when no question is a screening gate", () => {
    expect(findKnockout([question({ knockoutAnswer: null })], { q1: false })).toBeNull();
  });

  it("passes a yes_no gate when the answer matches", () => {
    const q = question({ type: "yes_no", knockoutAnswer: "yes" });
    expect(findKnockout([q], { q1: true })).toBeNull();
  });

  it("blocks a yes_no gate when the answer does not match", () => {
    const q = question({ type: "yes_no", knockoutAnswer: "yes" });
    expect(findKnockout([q], { q1: false })?.id).toBe("q1");
  });

  it("supports a gate that requires No", () => {
    const q = question({ type: "yes_no", knockoutAnswer: "no" });
    expect(findKnockout([q], { q1: false })).toBeNull();
    expect(findKnockout([q], { q1: true })?.id).toBe("q1");
  });

  it("matches a multiple_choice gate exactly", () => {
    const q = question({
      type: "multiple_choice",
      options: ["Istanbul", "Ankara", "Remote"],
      knockoutAnswer: "Istanbul",
    });
    expect(findKnockout([q], { q1: "Istanbul" })).toBeNull();
    expect(findKnockout([q], { q1: "Ankara" })?.id).toBe("q1");
  });

  it("ignores case and surrounding space when matching a choice", () => {
    const q = question({
      type: "multiple_choice",
      options: ["Istanbul"],
      knockoutAnswer: "Istanbul",
    });
    expect(findKnockout([q], { q1: "  istanbul " })).toBeNull();
  });

  it("never gates a free-text question, which cannot be checked mechanically", () => {
    for (const type of ["short_text", "long_text"] as const) {
      const q = question({ type, knockoutAnswer: "anything" });
      expect(findKnockout([q], { q1: "something else" }), type).toBeNull();
    }
  });

  it("returns the first failing gate when several fail", () => {
    const gates = [
      question({ id: "a", type: "yes_no", knockoutAnswer: "yes" }),
      question({ id: "b", type: "yes_no", knockoutAnswer: "yes" }),
    ];
    expect(findKnockout(gates, { a: false, b: false })?.id).toBe("a");
  });

  it("blocks a missing answer to a gate rather than letting it through", () => {
    const q = question({ type: "yes_no", knockoutAnswer: "yes" });
    expect(findKnockout([q], {})?.id).toBe("q1");
  });

  it("treats an empty gate value as no gate at all", () => {
    const q = question({ type: "yes_no", knockoutAnswer: "" });
    expect(findKnockout([q], { q1: false })).toBeNull();
  });
});

describe("knockoutLabel", () => {
  it("describes a yes_no requirement in words", () => {
    expect(knockoutLabel(question({ type: "yes_no", knockoutAnswer: "yes" }))).toBe(
      "Must answer Yes",
    );
    expect(knockoutLabel(question({ type: "yes_no", knockoutAnswer: "no" }))).toBe(
      "Must answer No",
    );
  });

  it("quotes the required choice", () => {
    const q = question({
      type: "multiple_choice",
      options: ["Istanbul"],
      knockoutAnswer: "Istanbul",
    });
    expect(knockoutLabel(q)).toBe("Must answer “Istanbul”");
  });

  it("is null when the question is not a gate", () => {
    expect(knockoutLabel(question({ knockoutAnswer: null }))).toBeNull();
    expect(knockoutLabel(question({ type: "short_text", knockoutAnswer: "x" }))).toBeNull();
  });
});
