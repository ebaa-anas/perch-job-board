import type { ApplicationStage } from "@/features/applications/pipeline";

/**
 * Canned wording for the messages that go to candidates.
 *
 * These exist for one reason: writing a rejection is the task recruiters put
 * off indefinitely, and a put-off rejection is a ghosted candidate. A decent
 * default one click away converts "I'll do it later" into a sent message.
 * Templates are starting points — the recruiter edits before sending.
 */

export interface MessageTemplate {
  id: string;
  label: string;
  /** Supports `{role}` and `{company}` placeholders. */
  body: string;
}

const TEMPLATES: Partial<Record<ApplicationStage, MessageTemplate[]>> = {
  reviewed: [
    {
      id: "reviewed-ack",
      label: "We're reviewing",
      body:
        "Thanks for applying to {role} at {company}. Your application is with " +
        "the hiring team now and we'll come back to you either way.",
    },
  ],
  interview: [
    {
      id: "interview-invite",
      label: "Invite to interview",
      body:
        "We'd like to talk to you about {role} at {company}. Reply with a few " +
        "times that suit you over the next week and we'll set something up.",
    },
    {
      id: "interview-task",
      label: "Invite with a task",
      body:
        "We'd like to take your {role} application further. The next step is a " +
        "short exercise, which should take under an hour — we'll send it across " +
        "once you confirm you're happy to proceed.",
    },
  ],
  offer: [
    {
      id: "offer-sent",
      label: "Offer on the way",
      body:
        "We'd like to offer you the {role} role at {company}. The written offer " +
        "is on its way — do come back to us with any questions.",
    },
  ],
  rejected: [
    {
      id: "rejected-plain",
      label: "Clear and brief",
      body:
        "Thank you for applying to {role} at {company}. We've decided not to " +
        "take your application further this time. We're grateful for the time " +
        "you put into it, and we wish you well with your search.",
    },
    {
      id: "rejected-close",
      label: "Close call",
      body:
        "Thank you for applying to {role} at {company}. This was a close " +
        "decision and we've gone with someone whose experience lined up more " +
        "exactly with the role. We'd genuinely welcome an application from you " +
        "for a future opening.",
    },
    {
      id: "rejected-experience",
      label: "Experience gap",
      body:
        "Thank you for applying to {role} at {company}. For this role we've " +
        "gone with candidates who had more direct experience in the area. " +
        "Nothing about your application was a problem — it was a question of " +
        "fit against this particular brief.",
    },
    {
      id: "rejected-role-closed",
      label: "Role withdrawn",
      body:
        "Thank you for applying to {role} at {company}. We're no longer hiring " +
        "for this position, so we're closing the applications we received. " +
        "Apologies for the outcome — it isn't a reflection on your application.",
    },
  ],
};

export function templatesForStage(stage: ApplicationStage): MessageTemplate[] {
  return TEMPLATES[stage] ?? [];
}

export interface TemplateValues {
  role: string;
  company: string;
}

/**
 * Substitute `{role}` / `{company}` in one pass.
 *
 * One pass, not sequential replaces: a company literally named `{role}` would
 * otherwise have its own name expanded by the next substitution. Unknown
 * placeholders are left verbatim so a typo shows up as `{rol}` rather than as
 * the word "undefined" in a message to a candidate.
 */
export function fillTemplate(body: string, values: TemplateValues): string {
  const lookup: Record<string, string> = {
    role: values.role,
    company: values.company,
  };
  return body.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in lookup ? lookup[key] : match,
  );
}
