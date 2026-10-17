import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { JobApplicationQuestion } from "@/features/jobs/types";
import { QuestionField } from "@/features/applications/components/question-field";

function question(overrides: Partial<JobApplicationQuestion>): JobApplicationQuestion {
  return {
    id: "q1",
    label: "Question",
    type: "short_text",
    required: true,
    options: [],
    knockoutAnswer: null,
    ...overrides,
  };
}

function render(q: JobApplicationQuestion, value?: string | boolean) {
  return renderToStaticMarkup(<QuestionField question={q} value={value} onChange={() => {}} />);
}

describe("QuestionField", () => {
  it("gives a short answer a single-line field capped at the server's limit", () => {
    const html = render(question({ type: "short_text" }), "");
    expect(html).toContain("<input");
    expect(html).not.toContain("<textarea");
    expect(html).toMatch(/maxlength="300"/i);
  });

  it("gives a long answer a multi-line field", () => {
    const html = render(question({ type: "long_text" }), "");
    expect(html).toContain("<textarea");
  });

  it("leaves an unanswered yes/no with neither option chosen", () => {
    const html = render(question({ type: "yes_no" }), undefined);
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).not.toContain("checked");
  });

  it("marks the chosen option once a yes/no is answered", () => {
    expect(render(question({ type: "yes_no" }), true).match(/checked=""/g)).toHaveLength(1);
  });
});
