import { describe, expect, it } from "vitest";

import { isOwnCvPath } from "@/features/profiles/cv-path";

const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("isOwnCvPath", () => {
  it("accepts a CV directly in the owner's folder", () => {
    expect(isOwnCvPath(`${OWNER}/cv.pdf`, OWNER)).toBe(true);
  });

  it("accepts nested paths under the owner's folder", () => {
    expect(isOwnCvPath(`${OWNER}/2026/cv.pdf`, OWNER)).toBe(true);
  });

  it("rejects another seeker's folder", () => {
    expect(isOwnCvPath(`${OTHER}/cv.pdf`, OWNER)).toBe(false);
  });

  it("rejects a folder that merely starts with the owner id", () => {
    // `startsWith(`${id}/`)` would also reject this one, but `startsWith(id)`
    // — the tempting simplification — would not.
    expect(isOwnCvPath(`${OWNER}-evil/cv.pdf`, OWNER)).toBe(false);
  });

  it("rejects traversal that normalises out of the owner's folder", () => {
    expect(isOwnCvPath(`${OWNER}/../${OTHER}/cv.pdf`, OWNER)).toBe(false);
  });

  it("rejects a bare `..` segment anywhere", () => {
    expect(isOwnCvPath(`${OWNER}/a/../cv.pdf`, OWNER)).toBe(false);
  });

  it("rejects backslashes, which split() on '/' would not catch", () => {
    expect(isOwnCvPath(`${OWNER}\\..\\${OTHER}\\cv.pdf`, OWNER)).toBe(false);
    expect(isOwnCvPath(`${OWNER}/a\\..\\b.pdf`, OWNER)).toBe(false);
  });

  it("rejects the folder with no file in it", () => {
    expect(isOwnCvPath(OWNER, OWNER)).toBe(false);
    expect(isOwnCvPath(`${OWNER}/`, OWNER)).toBe(false);
  });

  it("rejects empty, null and undefined paths", () => {
    expect(isOwnCvPath("", OWNER)).toBe(false);
    expect(isOwnCvPath(null, OWNER)).toBe(false);
    expect(isOwnCvPath(undefined, OWNER)).toBe(false);
  });

  it("rejects everything when the profile id is empty", () => {
    expect(isOwnCvPath(`${OWNER}/cv.pdf`, "")).toBe(false);
  });
});
