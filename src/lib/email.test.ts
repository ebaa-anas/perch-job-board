import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendApplicationStatusEmail, sendTeamInviteEmail } from "@/lib/email";

const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("send", () => {
  it("never mails a demo or seeded address, whatever the message", async () => {
    const result = await sendApplicationStatusEmail({
      to: "demo-seeker@seed.perch.test",
      jobTitle: "Frontend Developer",
      companyName: "Tidewater Studio",
      status: "interview",
      message: null,
    });

    expect(result).toEqual({ ok: false, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats the domain case-insensitively", async () => {
    await sendTeamInviteEmail({
      to: "Nadia@SEED.perch.test",
      companyName: "Northwind Labs",
      invitedByName: "Selin",
      role: "recruiter",
      token: "t",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still sends to a real address", async () => {
    const result = await sendApplicationStatusEmail({
      to: "seeker@example.com",
      jobTitle: "Frontend Developer",
      companyName: "Tidewater Studio",
      status: "interview",
      message: null,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
