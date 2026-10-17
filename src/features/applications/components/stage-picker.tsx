"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { setApplicationStage } from "@/features/applications/pipeline-actions";
import {
  STAGE_LABELS,
  isTerminalStage,
  nextStages,
  type ApplicationStage,
} from "@/features/applications/pipeline";
import {
  fillTemplate,
  templatesForStage,
} from "@/features/applications/message-templates";

/**
 * Move one candidate to a new stage, optionally with a message to them.
 *
 * The message box opens for a rejection because that is the case where
 * recruiters most often want to say something and least often bother: making
 * it one keystroke away is the difference between a template and silence.
 */
export function StagePicker({
  applicationId,
  stage,
  jobTitle,
  companyName,
  onMoved,
}: {
  applicationId: string;
  stage: ApplicationStage;
  /** Used to fill `{role}` / `{company}` in the message templates. */
  jobTitle: string;
  companyName: string;
  onMoved?: (stage: ApplicationStage) => void;
}) {
  const [target, setTarget] = React.useState<ApplicationStage | "">("");
  const [message, setMessage] = React.useState("");
  const [notify, setNotify] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const options = nextStages(stage);
  const templates = target ? templatesForStage(target) : [];

  if (options.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        This candidate is marked hired — the pipeline is closed.
      </p>
    );
  }

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    const result = await setApplicationStage({
      applicationId,
      stage: target,
      message: message.trim() || undefined,
      notify,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("");
    onMoved?.(target);
    setTarget("");
  };

  return (
    <div className="space-y-2">
      <label
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        htmlFor={`stage-${applicationId}`}
      >
        Move to
      </label>
      <Select
        id={`stage-${applicationId}`}
        value={target}
        onChange={(e) => setTarget(e.target.value as ApplicationStage)}
        disabled={busy}
      >
        <option value="">Choose a stage…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {STAGE_LABELS[option]}
          </option>
        ))}
      </Select>

      {target && (
        <>
          {templates.length > 0 && (
            <Select
              aria-label="Start from a template"
              value=""
              onChange={(e) => {
                const chosen = templates.find((t) => t.id === e.target.value);
                if (chosen) {
                  setMessage(
                    fillTemplate(chosen.body, {
                      role: jobTitle,
                      company: companyName,
                    }),
                  );
                }
              }}
              disabled={busy}
              className="h-9"
            >
              <option value="">Start from a template…</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </Select>
          )}
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={
              isTerminalStage(target)
                ? "Optional: a line of feedback for the candidate."
                : "Optional: what happens next."
            }
            disabled={busy}
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              disabled={busy}
              className="size-3.5 rounded border-input"
            />
            Email the candidate
          </label>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Move to {STAGE_LABELS[target]}
          </Button>
        </>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
