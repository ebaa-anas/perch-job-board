import "server-only";

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
}): Promise<SendResult> {
  const link = `${SITE_URL}/dashboard/jobs/${input.jobId}/applicants`;
  const snippet = input.note
    ? input.note.length > 240
      ? `${input.note.slice(0, 240)}…`
      : input.note
    : null;

  const subject = `New applicant for ${input.jobTitle}`;
  const lines = [
    `${input.applicantName} applied for ${input.jobTitle}.`,
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
        <p><strong>${escapeHtml(input.applicantName)}</strong> applied for
        <strong>${escapeHtml(input.jobTitle)}</strong>.</p>
        ${input.applicantHeadline ? `<p style="color:#555">${escapeHtml(input.applicantHeadline)}</p>` : ""}
        ${snippet ? `<blockquote style="border-left:3px solid #ddd;margin:0;padding-left:12px;color:#555">${escapeHtml(snippet)}</blockquote>` : ""}
        <p><a href="${link}" style="color:#1e5f45;font-weight:600">Review applicants →</a></p>
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
