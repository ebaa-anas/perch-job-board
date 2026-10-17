import "server-only";

import type { SeekerStatus } from "@/features/applications/pipeline";
import { isDemoUser } from "@/features/demo/demo-rules";

/**
 * Minimal transactional email via the Resend REST API — no SDK dependency.
 * Degrades gracefully: with no `RESEND_API_KEY` it logs and returns, so local
 * dev and un-provisioned deploys never crash a flow that sends mail.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM = process.env.EMAIL_FROM || "Perch <onboarding@resend.dev>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type SendResult = { ok: boolean; skipped?: boolean; error?: string };

async function send(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  // Demo and seeded accounts live on a reserved `.test` domain: nothing sent
  // there can arrive, and every bounce counts against the sender's reputation.
  if (isDemoUser(params.to)) {
    console.info(`[email] demo address — skipped "${params.subject}"`);
    return { ok: false, skipped: true };
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email] RESEND_API_KEY unset — skipped "${params.subject}" to ${params.to}`);
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, ...params }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend ${res.status}: ${body}`);
      return { ok: false, error: `Resend ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("[email] send failed", error);
    return { ok: false, error: "network" };
  }
}

export async function sendNewApplicantEmail(input: {
  to: string;
  jobId: string;
  jobTitle: string;
  applicantName: string;
  applicantHeadline: string | null;
  note: string | null;
  external?: boolean;
}): Promise<SendResult> {
  const link = `${SITE_URL}/dashboard/jobs/${input.jobId}/applicants`;
  const snippet = input.note
    ? input.note.length > 240
      ? `${input.note.slice(0, 240)}…`
      : input.note
    : null;

  const verb = input.external ? "clicked through to apply for" : "applied for";
  const subject = input.external
    ? `Someone applied externally for ${input.jobTitle}`
    : `New applicant for ${input.jobTitle}`;
  const lines = [
    `${input.applicantName} ${verb} ${input.jobTitle}.`,
    input.applicantHeadline ? `Headline: ${input.applicantHeadline}` : null,
    snippet ? `Note: ${snippet}` : null,
    `Review applicants: ${link}`,
  ].filter(Boolean) as string[];

  return send({
    to: input.to,
    subject,
    text: lines.join("\n\n"),
    html: `
      <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1b1a16">
        <p><strong>${escapeHtml(input.applicantName)}</strong> ${verb}
        <strong>${escapeHtml(input.jobTitle)}</strong>.</p>
        ${input.applicantHeadline ? `<p style="color:#555">${escapeHtml(input.applicantHeadline)}</p>` : ""}
        ${snippet ? `<blockquote style="border-left:3px solid #ddd;margin:0;padding-left:12px;color:#555">${escapeHtml(snippet)}</blockquote>` : ""}
        <p><a href="${link}" style="color:#1e5f45;font-weight:600">Review applicants →</a></p>
      </div>
    `,
  });
}

export async function sendAdminMessageEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return send({
    to: input.to,
    subject: input.subject,
    text: input.body,
    html: `
      <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1b1a16">
        ${paragraphs}
        <hr style="border:none;border-top:1px solid #ddd;margin:20px 0"/>
        <p style="color:#888;font-size:12px">Sent by a Perch administrator.</p>
      </div>
    `,
  });
}

/**
 * Tell a candidate their application moved.
 *
 * This is the email that closes the "application black hole": for most seekers
 * silence, not rejection, is the complaint. Copy is written to be readable on
 * its own — a candidate who applied weeks ago needs the role and the company
 * named, not just a status word.
 */
export async function sendApplicationStatusEmail(input: {
  to: string;
  jobTitle: string;
  companyName: string;
  status: SeekerStatus;
  /** Optional words from the recruiter, shown verbatim to the candidate. */
  message: string | null;
}): Promise<SendResult> {
  const { headline, subject } = STATUS_COPY[input.status](input);
  const link = `${SITE_URL}/dashboard`;

  const lines = [
    headline,
    input.message ? `From ${input.companyName}: ${input.message}` : null,
    `See all your applications: ${link}`,
  ].filter(Boolean) as string[];

  return send({
    to: input.to,
    subject,
    text: lines.join("\n\n"),
    html: `
      <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1b1a16">
        <p>${escapeHtml(headline)}</p>
        ${input.message ? `<blockquote style="border-left:3px solid #ddd;margin:0;padding-left:12px;color:#555">${escapeHtml(input.message)}</blockquote>` : ""}
        <p><a href="${link}" style="color:#1e5f45;font-weight:600">View your applications →</a></p>
      </div>
    `,
  });
}

type StatusCopyInput = { jobTitle: string; companyName: string };

const STATUS_COPY: Record<
  SeekerStatus,
  (input: StatusCopyInput) => { headline: string; subject: string }
> = {
  submitted: ({ jobTitle, companyName }) => ({
    subject: `Application received — ${jobTitle}`,
    headline: `${companyName} has your application for ${jobTitle}.`,
  }),
  in_review: ({ jobTitle, companyName }) => ({
    subject: `${companyName} is reviewing your application`,
    headline: `${companyName} has started reviewing your application for ${jobTitle}.`,
  }),
  interview: ({ jobTitle, companyName }) => ({
    subject: `Interview stage — ${jobTitle}`,
    headline: `${companyName} would like to move you to an interview for ${jobTitle}.`,
  }),
  offer: ({ jobTitle, companyName }) => ({
    subject: `An offer from ${companyName}`,
    headline: `${companyName} has marked your application for ${jobTitle} as an offer.`,
  }),
  hired: ({ jobTitle, companyName }) => ({
    subject: `Congratulations — ${jobTitle}`,
    headline: `${companyName} has marked you as hired for ${jobTitle}. Congratulations.`,
  }),
  not_selected: ({ jobTitle, companyName }) => ({
    subject: `Update on your application — ${jobTitle}`,
    headline:
      `${companyName} has decided not to move forward with your application for ` +
      `${jobTitle}. Thank you for the time you put into applying.`,
  }),
};

/**
 * The job-alert digest.
 *
 * One email per seeker per run, with a section per saved search, because the
 * alternative — one email per alert — is how a useful product becomes a spam
 * folder. Each row links straight to the job, and each section links back to
 * the search so the seeker can widen or narrow it.
 */
export async function sendJobAlertEmail(input: {
  to: string;
  sections: {
    label: string;
    query: string;
    jobs: { slug: string; title: string; company: { name: string } }[];
  }[];
}): Promise<SendResult> {
  const total = input.sections.reduce((sum, section) => sum + section.jobs.length, 0);
  const subject =
    total === 1
      ? "1 new job matching your alert"
      : `${total} new jobs matching your alerts`;

  const text = input.sections
    .map((section) =>
      [
        `${section.label} (${section.jobs.length})`,
        ...section.jobs.map(
          (job) =>
            `- ${job.title} at ${job.company.name}: ${SITE_URL}/jobs/${job.slug}`,
        ),
        `See all: ${SITE_URL}/jobs?${section.query}`,
      ].join("\n"),
    )
    .join("\n\n");

  const html = input.sections
    .map(
      (section) => `
        <h2 style="font-size:16px;margin:24px 0 8px">${escapeHtml(section.label)}
          <span style="color:#888;font-weight:400">(${section.jobs.length})</span>
        </h2>
        <ul style="margin:0;padding-left:18px">
          ${section.jobs
            .map(
              (job) => `<li style="margin-bottom:6px">
                <a href="${SITE_URL}/jobs/${job.slug}" style="color:#1e5f45;font-weight:600;text-decoration:none">${escapeHtml(job.title)}</a>
                <span style="color:#555"> at ${escapeHtml(job.company.name)}</span>
              </li>`,
            )
            .join("")}
        </ul>
        <p style="margin:8px 0 0">
          <a href="${SITE_URL}/jobs?${section.query}" style="color:#1e5f45;font-size:13px">See all results →</a>
        </p>`,
    )
    .join("");

  return send({
    to: input.to,
    subject,
    text,
    html: `
      <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1b1a16">
        ${html}
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
        <p style="color:#888;font-size:12px">
          You are getting this because you saved a job alert on Perch.
          <a href="${SITE_URL}/alerts" style="color:#888">Manage your alerts</a>.
        </p>
      </div>
    `,
  });
}

/**
 * Invite someone onto a company team.
 *
 * The token in this link is a bearer credential, so the copy names who sent
 * it and which company it is for: an invitation a recipient cannot place is
 * indistinguishable from a phishing attempt and gets deleted.
 */
export async function sendTeamInviteEmail(input: {
  to: string;
  companyName: string;
  invitedByName: string;
  role: "admin" | "recruiter";
  token: string;
}): Promise<SendResult> {
  const link = `${SITE_URL}/join?token=${encodeURIComponent(input.token)}`;
  const roleLabel = input.role === "admin" ? "an admin" : "a recruiter";
  const headline =
    `${input.invitedByName} invited you to join ${input.companyName} on Perch ` +
    `as ${roleLabel}.`;

  const lines = [
    headline,
    "You will be able to post jobs and review applicants for that company.",
    `Accept the invitation: ${link}`,
    "The link expires in 14 days.",
  ];

  return send({
    to: input.to,
    subject: `Join ${input.companyName} on Perch`,
    text: lines.join("\n\n"),
    html: `
      <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#1b1a16">
        <p>${escapeHtml(headline)}</p>
        <p style="color:#555">You will be able to post jobs and review applicants
        for that company.</p>
        <p><a href="${link}" style="color:#1e5f45;font-weight:600">Accept the invitation →</a></p>
        <p style="color:#888;font-size:12px">The link expires in 14 days. If you
        were not expecting this, you can ignore this email.</p>
      </div>
    `,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
