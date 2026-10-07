import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonClient, serviceClient } from "@/test/setup-integration";

/**
 * Tries the exploits that migration 0014 closes, against the linked hosted DB,
 * and expects each one to fail.
 *
 * Every assertion here depends on 0014 being applied, so the suite probes for it
 * and skips rather than reporting failures that only mean "not deployed yet".
 * Once `supabase db push` has run, these execute on the next `npm test`.
 *
 * `removeCv` (the fourth fix) is app-level rather than SQL and needs a server
 * action to run, so it lives in the e2e project instead — see
 * `src/test/e2e/cv-retention.e2e.test.ts`.
 */

const stamp = Date.now();
const PASSWORD = "perch-hardening-pw-8chars";

/**
 * 0014 is the only thing that sets a size ceiling on the `cvs` bucket, so a
 * non-null `file_size_limit` is a reliable marker. Supabase applies a migration
 * in one transaction, so a partial application isn't a case to worry about.
 */
async function isHardeningApplied(): Promise<boolean> {
  try {
    // getBucket reads the storage schema through the Storage API, which is the
    // supported way in; `from("buckets")` would look in `public` and miss it.
    const { data, error } = await serviceClient().storage.getBucket("cvs");
    if (error) return false;
    return data?.file_size_limit != null;
  } catch {
    return false;
  }
}

const APPLIED = await isHardeningApplied();
if (!APPLIED) {
  console.warn(
    "\n[security-hardening] SKIPPED — migration 0014 is not applied to the " +
      "linked database yet. Run `npm run db:push`, then re-run `npm test`.\n",
  );
}

const seeker = { email: `it-harden-seeker-${stamp}@perch.test`, id: "" };
const impostor = { email: `it-harden-impostor-${stamp}@perch.test`, id: "" };
let seekerClient: SupabaseClient;

beforeAll(async () => {
  if (!APPLIED) return;
  const svc = serviceClient();

  const { data, error } = await svc.auth.admin.createUser({
    email: seeker.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Hardening Seeker", role: "seeker" },
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  seeker.id = data.user.id;

  seekerClient = anonClient();
  const signIn = await seekerClient.auth.signInWithPassword({
    email: seeker.email,
    password: PASSWORD,
  });
  if (signIn.error) throw new Error(`sign-in failed: ${signIn.error.message}`);
});

afterAll(async () => {
  const svc = serviceClient();
  for (const id of [seeker.id, impostor.id]) {
    if (id) await svc.auth.admin.deleteUser(id);
  }
});

// ---------------------------------------------------------------------------
// 1. Self-service admin signup
// ---------------------------------------------------------------------------
describe.skipIf(!APPLIED)("[needs migration 0014] handle_new_user ignores a forged role", () => {
  it("leaves profiles.role NULL when signup metadata asks for admin", async () => {
    // The exploit exactly as an attacker runs it: the public anon key, straight
    // at GoTrue, no server action involved.
    const { data, error } = await anonClient().auth.signUp({
      email: impostor.email,
      password: PASSWORD,
      options: { data: { full_name: "Mallory", role: "admin" } },
    });
    expect(error).toBeNull();
    impostor.id = data.user?.id ?? "";
    expect(impostor.id).not.toBe("");

    const { data: profile } = await serviceClient()
      .from("profiles")
      .select("role")
      .eq("id", impostor.id)
      .single();
    expect(profile?.role).toBeNull();
  });

  it("still honours a legitimate seeker role from metadata", async () => {
    const { data: profile } = await serviceClient()
      .from("profiles")
      .select("role")
      .eq("id", seeker.id)
      .single();
    expect(profile?.role).toBe("seeker");
  });

  it("leaves no admin whose email is absent from admin_emails", async () => {
    const svc = serviceClient();
    const { data: admins } = await svc
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    const { data: listed } = await svc.from("admin_emails").select("email");
    const allowed = new Set(
      (listed ?? []).map((r) => (r.email ?? "").trim().toLowerCase()),
    );

    for (const row of admins ?? []) {
      const { data: user } = await svc.auth.admin.getUserById(row.id);
      const email = (user.user?.email ?? "").trim().toLowerCase();
      expect(allowed.has(email)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Fit-score quota rows are read-only to their owner
// ---------------------------------------------------------------------------
describe.skipIf(!APPLIED)("[needs migration 0014] job_fit_scores is read-only to the seeker", () => {
  let jobId = "";

  beforeAll(async () => {
    const svc = serviceClient();
    const { data: job } = await svc
      .from("jobs")
      .select("id")
      .eq("status", "published")
      .limit(1)
      .maybeSingle();
    jobId = job?.id ?? "";
    if (!jobId) return;

    // Seeded with the service role, which is how getFitScore writes it now.
    await svc.from("job_fit_scores").upsert({
      seeker_id: seeker.id,
      job_id: jobId,
      input_hash: "hardening-test-hash",
      score: 42,
      summary: "seeded by the hardening integration test",
      strengths: [],
      gaps: [],
      updated_at: new Date().toISOString(),
    });
  });

  it("lets the seeker read their own row", async () => {
    if (!jobId) return;
    const { data, error } = await seekerClient
      .from("job_fit_scores")
      .select("score, input_hash")
      .eq("seeker_id", seeker.id)
      .eq("job_id", jobId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.score).toBe(42);
  });

  it("does not let the seeker delete their row to reset the daily cap", async () => {
    if (!jobId) return;
    await seekerClient
      .from("job_fit_scores")
      .delete()
      .eq("seeker_id", seeker.id)
      .eq("job_id", jobId);

    // RLS filters the delete to nothing rather than erroring, so the row
    // surviving is the assertion that matters.
    const { data } = await serviceClient()
      .from("job_fit_scores")
      .select("job_id")
      .eq("seeker_id", seeker.id)
      .eq("job_id", jobId)
      .maybeSingle();
    expect(data).not.toBeNull();
  });

  it("does not let the seeker backdate updated_at to reset the daily cap", async () => {
    if (!jobId) return;
    const backdated = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await seekerClient
      .from("job_fit_scores")
      .update({ updated_at: backdated })
      .eq("seeker_id", seeker.id)
      .eq("job_id", jobId);

    const { data } = await serviceClient()
      .from("job_fit_scores")
      .select("updated_at")
      .eq("seeker_id", seeker.id)
      .eq("job_id", jobId)
      .maybeSingle();
    expect(data?.updated_at).not.toBe(backdated);
  });

  it("does not let the seeker insert a row for somebody else", async () => {
    if (!jobId) return;
    const { error } = await seekerClient.from("job_fit_scores").insert({
      seeker_id: "00000000-0000-0000-0000-000000000000",
      job_id: jobId,
      input_hash: "forged",
      score: 100,
      summary: "forged",
    });
    expect(error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Storage buckets enforce size and type server-side
// ---------------------------------------------------------------------------
describe.skipIf(!APPLIED)("[needs migration 0014] storage buckets reject oversized and wrong-type files", () => {
  it("rejects a CV over the 5 MB ceiling", async () => {
    const tooBig = new Uint8Array(5 * 1024 * 1024 + 1024);
    const { error } = await seekerClient.storage
      .from("cvs")
      .upload(`${seeker.id}/oversized-${stamp}.pdf`, tooBig, {
        contentType: "application/pdf",
        upsert: true,
      });
    expect(error).not.toBeNull();
  });

  it("rejects text/html uploaded to the cvs bucket", async () => {
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    const { error } = await seekerClient.storage
      .from("cvs")
      .upload(`${seeker.id}/payload-${stamp}.html`, html, {
        contentType: "text/html",
        upsert: true,
      });
    expect(error).not.toBeNull();
  });

  it("rejects text/html uploaded to the logos bucket", async () => {
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    const { error } = await seekerClient.storage
      .from("logos")
      .upload(`${seeker.id}/payload-${stamp}.html`, html, {
        contentType: "text/html",
        upsert: true,
      });
    expect(error).not.toBeNull();
  });

  it("rejects a logo over the 2 MB ceiling", async () => {
    const tooBig = new Uint8Array(2 * 1024 * 1024 + 1024);
    const { error } = await seekerClient.storage
      .from("logos")
      .upload(`${seeker.id}/oversized-${stamp}.png`, tooBig, {
        contentType: "image/png",
        upsert: true,
      });
    expect(error).not.toBeNull();
  });

  it("records ceilings that match the upload components", async () => {
    const svc = serviceClient();

    const cvs = await svc.storage.getBucket("cvs");
    expect(cvs.data?.file_size_limit).toBe(5 * 1024 * 1024); // CV_MAX_BYTES
    expect(cvs.data?.allowed_mime_types).toEqual(
      expect.arrayContaining([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]),
    );

    for (const id of ["logos", "avatars"]) {
      const bucket = await svc.storage.getBucket(id);
      expect(bucket.data?.file_size_limit).toBe(2 * 1024 * 1024); // LOGO_MAX_BYTES
      expect(bucket.data?.allowed_mime_types).toEqual(
        expect.arrayContaining([
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/svg+xml",
        ]),
      );
    }
  });
});
