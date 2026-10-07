-- ============================================================================
-- Perch Phase 12 — screening gates on application questions.
--
-- `knockout_answer` turns an existing question into a gate: the one answer
-- that lets an application through. An applicant who does not match is told
-- at the point of applying instead of waiting weeks for a rejection that was
-- mechanical from the start — which makes this as much a candidate feature as
-- a recruiter one.
--
-- Only `yes_no` and `multiple_choice` are honoured (enforced in
-- `findKnockout`, not here, so a recruiter who later changes a question's
-- type does not lose the stored value). Free text is never gated: there is no
-- honest mechanical test for whether a sentence matches, and a false
-- rejection costs someone a job.
-- ============================================================================

alter table public.job_application_questions
  add column if not exists knockout_answer text;

-- A gate must be answerable: an empty string is not a gate, it is a mistake.
alter table public.job_application_questions
  drop constraint if exists job_application_questions_knockout_not_blank;
alter table public.job_application_questions
  add constraint job_application_questions_knockout_not_blank
  check (knockout_answer is null or length(btrim(knockout_answer)) > 0);
