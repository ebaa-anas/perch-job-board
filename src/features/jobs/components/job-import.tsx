"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { importJobsFromCsv } from "@/features/jobs/import-actions";
import {
  CSV_COLUMNS,
  CSV_TEMPLATE,
  MAX_IMPORT_ROWS,
  parseJobsCsv,
  type CsvRowError,
} from "@/features/jobs/csv-import";

/**
 * Bulk import.
 *
 * The file is parsed in the browser first and the result previewed, so a
 * recruiter sees "18 jobs ready, 2 rows to fix" before anything is written.
 * The same pure parser runs again on the server — the preview is a courtesy,
 * never the validation.
 */
export function JobImport() {
  const router = useRouter();
  const [csv, setCsv] = React.useState("");
  const [publish, setPublish] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [report, setReport] = React.useState<
    { created: number; errors: CsvRowError[] } | null
  >(null);
  const [fatal, setFatal] = React.useState<string | null>(null);

  const preview = React.useMemo(
    () => (csv.trim() ? parseJobsCsv(csv) : null),
    [csv],
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReport(null);
    setFatal(null);
    setCsv(await file.text());
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "perch-jobs-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    setBusy(true);
    setFatal(null);
    setReport(null);
    const result = await importJobsFromCsv({ csv, publish });
    setBusy(false);
    if (!result.ok) {
      setFatal(result.error);
      return;
    }
    setReport({ created: result.created, errors: result.errors });
    if (result.created > 0) router.refresh();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">1. Start from the template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One row per job, up to {MAX_IMPORT_ROWS} at a time. List columns
          (responsibilities, requirements, perks, tags) are separated with{" "}
          <code className="rounded bg-muted px-1">|</code> so you can use commas
          in your text freely.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={downloadTemplate}>
          <Download className="size-4" />
          Download CSV template
        </Button>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Column reference
          </summary>
          <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
            {CSV_COLUMNS.map((column) => (
              <li key={column}>
                <code className="rounded bg-muted px-1">{column}</code>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">2. Upload or paste</h2>
        <div className="mt-3 space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm"
          />
          <Textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setReport(null);
            }}
            rows={8}
            placeholder="…or paste CSV here"
            className="font-mono text-xs"
          />
        </div>
      </section>

      {preview && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">3. Check the preview</h2>
          <p className="mt-1 text-sm">
            <span className="font-medium">{preview.jobs.length}</span>{" "}
            {preview.jobs.length === 1 ? "job" : "jobs"} ready
            {preview.errors.length > 0 && (
              <>
                ,{" "}
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  {preview.errors.length}
                </span>{" "}
                {preview.errors.length === 1 ? "row" : "rows"} to fix
              </>
            )}
            .
          </p>

          {preview.errors.length > 0 && <ErrorList errors={preview.errors} />}

          {preview.jobs.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {preview.jobs.slice(0, 10).map((job, index) => (
                <li key={`${job.title}-${index}`} className="text-muted-foreground">
                  <span className="text-foreground">{job.title}</span> ·{" "}
                  {job.location} · {job.type}
                </li>
              ))}
              {preview.jobs.length > 10 && (
                <li className="text-xs text-muted-foreground">
                  …and {preview.jobs.length - 10} more
                </li>
              )}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
                className="size-4 rounded border-input accent-primary"
              />
              Publish immediately (otherwise imported as drafts)
            </label>
            <Button
              onClick={submit}
              disabled={busy || preview.jobs.length === 0}
              className="ml-auto"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Import {preview.jobs.length}{" "}
              {preview.jobs.length === 1 ? "job" : "jobs"}
            </Button>
          </div>
        </section>
      )}

      {fatal && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          {fatal}
        </p>
      )}

      {report && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">Result</h2>
          <p className="mt-1 text-sm">
            Imported <span className="font-medium">{report.created}</span>{" "}
            {report.created === 1 ? "job" : "jobs"}
            {publish ? " and published them" : " as drafts"}.
          </p>
          {report.errors.length > 0 && <ErrorList errors={report.errors} />}
        </section>
      )}
    </div>
  );
}

function ErrorList({ errors }: { errors: CsvRowError[] }) {
  return (
    <ul className="mt-3 space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
      {errors.slice(0, 25).map((error, index) => (
        <li key={`${error.line}-${index}`}>
          <span className="font-medium">Line {error.line}:</span>{" "}
          <span className="text-muted-foreground">{error.message}</span>
        </li>
      ))}
      {errors.length > 25 && (
        <li className="text-xs text-muted-foreground">
          …and {errors.length - 25} more
        </li>
      )}
    </ul>
  );
}
