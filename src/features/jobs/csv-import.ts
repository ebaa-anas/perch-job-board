import { jobEditorApiSchema, type JobEditorInput } from "@/features/jobs/schema";

/**
 * Bulk job import from CSV.
 *
 * Recruiters will not retype forty roles, so without an import path a company
 * with an existing pipeline simply does not move onto the product. Everything
 * here is pure and synchronous: a bad import is the kind of thing that
 * silently mangles a batch of listings, so the parsing and validation are
 * testable without a database or a file upload.
 *
 * Two deliberate choices:
 *   * list columns are split on `|`, not `,`, so a recruiter can write prose
 *     with commas in a cell without quoting anything;
 *   * a row that fails validation is reported with its spreadsheet line
 *     number and skipped, while the good rows still import. A single typo in
 *     row 30 must not reject the other 29.
 */

export const CSV_COLUMNS = [
  "title",
  "location",
  "type",
  "work_mode",
  "experience",
  "salary_min",
  "salary_max",
  "description",
  "responsibilities",
  "requirements",
  "perks",
  "tags",
  "no_experience_required",
  "visa_sponsorship",
  "language",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** One import is one sitting's work; beyond this, use the API. */
export const MAX_IMPORT_ROWS = 200;

export interface CsvRowError {
  /** 1-based line in the file, counting the header — what a spreadsheet shows. */
  line: number;
  message: string;
}

export interface CsvImportResult {
  jobs: JobEditorInput[];
  /**
   * Source line of each accepted job, parallel to `jobs`. Carried so a later
   * database failure can be reported against the line the recruiter sees in
   * their spreadsheet, rather than against its position among accepted rows.
   */
  jobLines: number[];
  errors: CsvRowError[];
}

/* -------------------------------------------------------------------------- */
/*  RFC 4180-ish reader                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Split CSV text into rows of cells.
 *
 * Hand-rolled rather than pulled in as a dependency: the dialect needed here
 * is small and fully specified by the tests (quoted commas, doubled quotes,
 * embedded newlines, CRLF). A quote appearing in the middle of an unquoted
 * field is taken literally, which is what spreadsheets do.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let cellStarted = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
    cellStarted = false;
  };
  const endRow = () => {
    endCell();
    // A row of empty cells is a blank line, not a record.
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && !cellStarted) {
      quoted = true;
      cellStarted = true;
      continue;
    }
    if (char === ",") {
      endCell();
      continue;
    }
    if (char === "\r") {
      // Swallow CR; the LF that follows ends the row.
      continue;
    }
    if (char === "\n") {
      endRow();
      continue;
    }
    cell += char;
    cellStarted = true;
  }

  // Whatever is buffered at EOF is the last row, if it holds anything.
  if (cell !== "" || row.length > 0) endRow();

  return rows;
}

/* -------------------------------------------------------------------------- */
/*  Cell coercion                                                              */
/* -------------------------------------------------------------------------- */

const TRUTHY = new Set(["true", "yes", "y", "1"]);

function toBoolean(value: string): boolean {
  return TRUTHY.has(value.trim().toLowerCase());
}

/** `A | B | C` → `["A", "B", "C"]`, blanks dropped. */
function toList(value: string): string[] {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed.replace(/[\s,_]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/* -------------------------------------------------------------------------- */
/*  Row → job                                                                  */
/* -------------------------------------------------------------------------- */

function normaliseHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Turns a Zod issue into something a recruiter can act on from a spreadsheet. */
function describeIssues(
  issues: { path: PropertyKey[]; message: string }[],
): string {
  return issues
    .slice(0, 3)
    .map((issue) => {
      const field = issue.path[0];
      return field ? `${String(field)}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export function parseJobsCsv(text: string): CsvImportResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return {
      jobs: [],
      jobLines: [],
      errors: [{ line: 1, message: "The file is empty." }],
    };
  }

  const header = rows[0].map(normaliseHeader);
  const missing = CSV_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return {
      jobs: [],
      jobLines: [],
      errors: [
        {
          line: 1,
          message: `Header is missing these columns: ${missing.join(", ")}.`,
        },
      ],
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    return {
      jobs: [],
      jobLines: [],
      errors: [{ line: 1, message: "The file has a header but no rows." }],
    };
  }

  const jobs: JobEditorInput[] = [];
  const jobLines: number[] = [];
  const errors: CsvRowError[] = [];

  if (dataRows.length > MAX_IMPORT_ROWS) {
    errors.push({
      line: 1,
      message: `You can import at most ${MAX_IMPORT_ROWS} jobs at a time; this file has ${dataRows.length}.`,
    });
  }

  // Index of each known column, so headers may appear in any order.
  const at = new Map<CsvColumn, number>(
    CSV_COLUMNS.map((column) => [column, header.indexOf(column)]),
  );

  dataRows.slice(0, MAX_IMPORT_ROWS).forEach((cells, index) => {
    const line = index + 2; // 1-based, plus the header row.

    if (cells.length !== header.length) {
      errors.push({
        line,
        message: `Expected ${header.length} columns, found ${cells.length}.`,
      });
      return;
    }

    const cell = (column: CsvColumn): string => cells[at.get(column)!] ?? "";

    const salaryMin = toNumber(cell("salary_min"));
    const salaryMax = toNumber(cell("salary_max"));
    if (salaryMin === null || salaryMax === null) {
      errors.push({
        line,
        message: "salary_min and salary_max must both be numbers.",
      });
      return;
    }

    const candidate = {
      title: cell("title"),
      location: cell("location"),
      type: cell("type").trim().toLowerCase(),
      workMode: cell("work_mode").trim().toLowerCase(),
      experience: cell("experience").trim().toLowerCase(),
      salaryMin,
      salaryMax,
      description: cell("description"),
      responsibilities: toList(cell("responsibilities")),
      requirements: toList(cell("requirements")),
      perks: toList(cell("perks")),
      tags: toList(cell("tags")),
      noExperienceRequired: toBoolean(cell("no_experience_required")),
      visaSponsorship: toBoolean(cell("visa_sponsorship")),
      language: cell("language").trim().toLowerCase() || "en",
      questions: [],
    };

    const parsed = jobEditorApiSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({ line, message: describeIssues(parsed.error.issues) });
      return;
    }
    jobs.push(parsed.data);
    jobLines.push(line);
  });

  return { jobs, jobLines, errors };
}

/* -------------------------------------------------------------------------- */
/*  Template                                                                   */
/* -------------------------------------------------------------------------- */

const TEMPLATE_ROWS = [
  [
    "Frontend Engineer",
    "Istanbul, Türkiye",
    "full-time",
    "hybrid",
    "mid",
    "40000",
    "60000",
    "Build and maintain our customer-facing web application, working closely with design and product.",
    "Ship features end to end | Review teammates' code | Help shape the roadmap",
    "3+ years with React | Strong TypeScript | Comfortable with testing",
    "Private health cover | Learning budget",
    "react | typescript | next.js",
    "false",
    "true",
    "en",
  ],
  [
    "Junior Data Analyst",
    "Remote",
    "internship",
    "remote",
    "junior",
    "0",
    "0",
    "Join our analytics team and learn to turn raw product data into decisions the business acts on.",
    "Build dashboards | Answer questions with SQL",
    "Curiosity | Basic SQL",
    "",
    "sql | analytics",
    "true",
    "false",
    "en",
  ],
];

function toCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A filled-in example file, offered as a download next to the upload box. */
export const CSV_TEMPLATE = [
  CSV_COLUMNS.join(","),
  ...TEMPLATE_ROWS.map((row) => row.map(toCsvCell).join(",")),
].join("\n");
