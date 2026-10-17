import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { serviceClient } from "@/test/setup-integration";

/**
 * Migration 0023: the half of the demo protections that has to live in the
 * database, because a visitor on a shared demo login holds a real session and
 * can reach the Auth API without passing through any Server Action.
 *
 * Driven through the admin API, which writes the same `auth.users` columns as
 * a user's own `updateUser` call but sends no confirmation email.
 */

const stamp = Date.now();
const demo = { email: `it-demo-${stamp}@seed.perch.test`, id: "" };
const real = { email: `it-demo-real-${stamp}@perch.test`, id: "" };

async function makeUser(email: string) {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: email, role: "seeker" },
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  return data.user.id;
}

async function emailOf(id: string) {
  const { data } = await serviceClient().auth.admin.getUserById(id);
  return data.user?.email;
}

beforeAll(async () => {
  [demo.id, real.id] = await Promise.all([makeUser(demo.email), makeUser(real.email)]);
});

afterAll(async () => {
  const svc = serviceClient();
  await Promise.all(
    [demo.id, real.id].filter(Boolean).map((id) => svc.auth.admin.deleteUser(id)),
  );
});

describe("demo account email", () => {
  it("cannot be moved off the demo domain", async () => {
    const { error } = await serviceClient().auth.admin.updateUserById(demo.id, {
      email: `it-demo-moved-${stamp}@perch.test`,
      email_confirm: true,
    });
    expect(error).not.toBeNull();
    expect(await emailOf(demo.id)).toBe(demo.email);
  });

  it("cannot be claimed by moving a real account onto the domain", async () => {
    const { error } = await serviceClient().auth.admin.updateUserById(real.id, {
      email: `it-demo-claim-${stamp}@seed.perch.test`,
      email_confirm: true,
    });
    expect(error).not.toBeNull();
    expect(await emailOf(real.id)).toBe(real.email);
  });

  it("leaves real accounts free to change their address", async () => {
    const next = `it-demo-real2-${stamp}@perch.test`;
    const { error } = await serviceClient().auth.admin.updateUserById(real.id, {
      email: next,
      email_confirm: true,
    });
    expect(error).toBeNull();
    expect(await emailOf(real.id)).toBe(next);
  });

  it("still lets the seed re-key a demo account and rename it", async () => {
    const { error } = await serviceClient().auth.admin.updateUserById(demo.id, {
      password: randomUUID(),
      user_metadata: { full_name: "Renamed by the seed" },
    });
    expect(error).toBeNull();
  });
});

describe("admin_emails", () => {
  it("refuses a demo address", async () => {
    const { error } = await serviceClient()
      .from("admin_emails")
      .insert({ email: `it-demo-admin-${stamp}@seed.perch.test` });
    expect(error?.code).toBe("23514");
  });

  it("refuses one written in capitals, too", async () => {
    const { error } = await serviceClient()
      .from("admin_emails")
      .insert({ email: `IT-DEMO-ADMIN-${stamp}@SEED.PERCH.TEST` });
    expect(error?.code).toBe("23514");
  });
});
