import { describe, expect, it } from "vitest";

import {
  CSV_COLUMNS,
  CSV_TEMPLATE,
  parseCsv,
  parseJobsCsv,
} from "@/features/jobs/csv-import";

describe("parseCsv", () => {
  it("splits a simple row", () => {
    expect(parseCsv("a,b,c")).toEqual([["a", "b", "c"]]);
  });

  it("keeps a comma inside quotes", () => {
    expect(parseCsv('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it("unescapes a doubled quote", () => {
    expect(parseCsv('a,"say ""hi""",b')).toEqual([["a", 'say "hi"', "b"]]);
  });

  it("keeps a newline inside quotes", () => {
    expect(parseCsv('a,"line1\nline2",b')).toEqual([["a", "line1\nline2", "b"]]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("preserves empty fields", () => {
    expect(parseCsv("a,,c")).toEqual([["a", "", "c"]]);
  });

  it("drops a trailing blank line", () => {
    expect(parseCsv("a,b\n")).toEqual([["a", "b"]]);
  });

  it("drops a whitespace-only line between rows", () => {
    expect(parseCsv("a,b\n   \nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("   \n  ")).toEqual([]);
  });

  it("treats a quote inside an unquoted field literally", () => {
    expect(parseCsv('a,b"c,d')).toEqual([["a", 'b"c', "d"]]);
  });
});

/* -------------------------------------------------------------------------- */

const HEADER = CSV_COLUMNS.join(",");

function row(overrides: Partial<Record<string, string>> = {}): string {
  const values: Record<string, string> = {
    title: "Frontend Engineer",
    location: "Istanbul",
    type: "full-time",
    work_mode: "remote",
    experience: "mid",
    salary_min: "40000",
    salary_max: "60000",
    description:
      "We are hiring a frontend engineer to build and maintain our web application end to end.",
    responsibilities: "Ship features | Review code",
    requirements: "React | TypeScript",
    perks: "Laptop",
    tags: "react | typescript",
    no_experience_required: "false",
    visa_sponsorship: "true",
    language: "en",
    ...overrides,
  };
  return CSV_COLUMNS.map((c) => {
    const v = values[c] ?? "";
    return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(",");
}

describe("parseJobsCsv", () => {
  it("parses a valid row into a job payload", () => {
    const result = parseJobsCsv(`${HEADER}\n${row()}`);
    expect(result.errors).toEqual([]);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      title: "Frontend Engineer",
      location: "Istanbul",
      type: "full-time",
      workMode: "remote",
      experience: "mid",
      salaryMin: 40000,
      salaryMax: 60000,
      responsibilities: ["Ship features", "Review code"],
      requirements: ["React", "TypeScript"],
      perks: ["Laptop"],
      tags: ["react", "typescript"],
      noExperienceRequired: false,
      visaSponsorship: true,
      language: "en",
    });
  });

  it("reports a missing header rather than guessing column order", () => {
    const result = parseJobsCsv("title,location\nOne,Two");
    expect(result.jobs).toEqual([]);
    expect(result.errors[0].message).toMatch(/missing/i);
  });

  it("accepts headers in any order", () => {
    const reversed = [...CSV_COLUMNS].reverse();
    const values = Object.fromEntries(
      CSV_COLUMNS.map((c, i) => [c, row().split(",")[i]]),
    );
    void values;
    const header = reversed.join(",");
    const cells = reversed.map((c) => {
      const index = CSV_COLUMNS.indexOf(c);
      return parseCsv(row())[0][index];
    });
    const quoted = cells.map((v) =>
      v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v,
    );
    const result = parseJobsCsv(`${header}\n${quoted.join(",")}`);
    expect(result.errors).toEqual([]);
    expect(result.jobs[0].title).toBe("Frontend Engineer");
  });

  it("is case- and space-insensitive about header names", () => {
    const header = CSV_COLUMNS.map((c) => ` ${c.toUpperCase()} `).join(",");
    const result = parseJobsCsv(`${header}\n${row()}`);
    expect(result.errors).toEqual([]);
  });

  it("reports an empty file", () => {
    expect(parseJobsCsv("").errors[0].message).toMatch(/empty/i);
  });

  it("reports a file with only a header", () => {
    const result = parseJobsCsv(HEADER);
    expect(result.jobs).toEqual([]);
    expect(result.errors[0].message).toMatch(/no rows/i);
  });

  it("attributes an error to its spreadsheet line number", () => {
    // Line 1 is the header, so the first data row is line 2.
    const result = parseJobsCsv(`${HEADER}\n${row({ title: "X" })}`);
    expect(result.errors[0].line).toBe(2);
  });

  it("rejects an unknown enum value with a readable message", () => {
    const result = parseJobsCsv(`${HEADER}\n${row({ type: "freelance" })}`);
    expect(result.jobs).toEqual([]);
    expect(result.errors[0].message).toMatch(/type/i);
  });

  it("rejects a non-numeric salary", () => {
    const result = parseJobsCsv(`${HEADER}\n${row({ salary_min: "forty" })}`);
    expect(result.errors[0].message).toMatch(/salary/i);
  });

  it("rejects a salary range that runs backwards", () => {
    const result = parseJobsCsv(
      `${HEADER}\n${row({ salary_min: "90000", salary_max: "10000" })}`,
    );
    expect(result.errors).toHaveLength(1);
    expect(result.jobs).toEqual([]);
  });

  it("keeps the good rows and reports only the bad ones", () => {
    const csv = [HEADER, row(), row({ type: "freelance" }), row()].join("\n");
    const result = parseJobsCsv(csv);
    expect(result.jobs).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(3);
  });

  it("accepts yes/no and 1/0 for the boolean columns", () => {
    for (const truthy of ["true", "TRUE", "yes", "Y", "1"]) {
      const result = parseJobsCsv(`${HEADER}\n${row({ visa_sponsorship: truthy })}`);
      expect(result.jobs[0]?.visaSponsorship, truthy).toBe(true);
    }
    for (const falsy of ["false", "no", "0", ""]) {
      const result = parseJobsCsv(`${HEADER}\n${row({ visa_sponsorship: falsy })}`);
      expect(result.jobs[0]?.visaSponsorship, falsy).toBe(false);
    }
  });

  it("defaults language to en when the column is blank", () => {
    const result = parseJobsCsv(`${HEADER}\n${row({ language: "" })}`);
    expect(result.jobs[0].language).toBe("en");
  });

  it("splits list columns on the pipe and drops blanks", () => {
    const result = parseJobsCsv(
      `${HEADER}\n${row({ tags: " react |  | typescript | " })}`,
    );
    expect(result.jobs[0].tags).toEqual(["react", "typescript"]);
  });

  it("treats an empty perks column as an empty list, not an error", () => {
    const result = parseJobsCsv(`${HEADER}\n${row({ perks: "" })}`);
    expect(result.errors).toEqual([]);
    expect(result.jobs[0].perks).toEqual([]);
  });

  it("reports a row with the wrong number of cells", () => {
    const result = parseJobsCsv(`${HEADER}\na,b,c`);
    expect(result.jobs).toEqual([]);
    expect(result.errors[0].message).toMatch(/column/i);
  });

  it("reports the source line of each accepted job", () => {
    const csv = [HEADER, row(), row({ type: "freelance" }), row()].join("\n");
    const result = parseJobsCsv(csv);
    // Rows 2 and 4 were accepted; row 3 was rejected.
    expect(result.jobLines).toEqual([2, 4]);
  });

  it("caps the number of rows it will accept", () => {
    const many = [HEADER, ...Array.from({ length: 201 }, () => row())].join("\n");
    const result = parseJobsCsv(many);
    expect(result.errors.some((e) => /at most/i.test(e.message))).toBe(true);
  });
});

describe("CSV_TEMPLATE", () => {
  it("round-trips through the parser with no errors", () => {
    const result = parseJobsCsv(CSV_TEMPLATE);
    expect(result.errors).toEqual([]);
    expect(result.jobs.length).toBeGreaterThan(0);
  });

  it("starts with the documented header", () => {
    expect(CSV_TEMPLATE.split("\n")[0]).toBe(CSV_COLUMNS.join(","));
  });
});
