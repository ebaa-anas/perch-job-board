import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ANSWER_MAX_LENGTH, type AnswerValue } from "@/features/applications/answers";
import type { JobApplicationQuestion } from "@/features/jobs/types";

/** One recruiter-written question in the apply form. */
export function QuestionField({
  question,
  value,
  error,
  onChange,
}: {
  question: JobApplicationQuestion;
  value: AnswerValue | undefined;
  error?: string;
  onChange: (value: AnswerValue) => void;
}) {
  const label = (
    <label htmlFor={`q-${question.id}`} className="text-sm font-medium">
      {question.label}
      {!question.required && <span className="text-muted-foreground"> (optional)</span>}
    </label>
  );
  const errorText = error ? (
    <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
  ) : null;

  if (question.type === "yes_no") {
    return (
      <div className="space-y-1.5">
        {label}
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={value === true}
              onChange={() => onChange(true)}
            />
            Yes
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={value === false}
              onChange={() => onChange(false)}
            />
            No
          </label>
        </div>
        {errorText}
      </div>
    );
  }

  if (question.type === "multiple_choice") {
    return (
      <div className="space-y-1.5">
        {label}
        <Select
          id={`q-${question.id}`}
          value={typeof value === "string" ? value : ""}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Choose one…
          </option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        {errorText}
      </div>
    );
  }

  const text = typeof value === "string" ? value : "";
  return (
    <div className="space-y-1.5">
      {label}
      {question.type === "short_text" ? (
        <Input
          id={`q-${question.id}`}
          value={text}
          maxLength={ANSWER_MAX_LENGTH.short_text}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Textarea
          id={`q-${question.id}`}
          rows={4}
          value={text}
          maxLength={ANSWER_MAX_LENGTH.long_text}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {errorText}
    </div>
  );
}
