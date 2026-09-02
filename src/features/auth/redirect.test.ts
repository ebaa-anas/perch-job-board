import { describe, expect, it } from "vitest";

import { safeRelativePath } from "@/features/auth/redirect";

const TAB = String.fromCharCode(9);
const NEWLINE = String.fromCharCode(10);
const NUL = String.fromCharCode(0);
const DEL = String.fromCharCode(127);

describe("safeRelativePath", () => {
  it("accepts a plain local path", () => {
    expect(safeRelativePath("/dashboard")).toBe("/dashboard");
    expect(safeRelativePath("/jobs/abc?x=1#y")).toBe("/jobs/abc?x=1#y");
    expect(safeRelativePath("/")).toBe("/");
  });

  it("rejects empty / nullish input", () => {
    expect(safeRelativePath("")).toBeNull();
    expect(safeRelativePath(null)).toBeNull();
    expect(safeRelativePath(undefined)).toBeNull();
  });

  it("rejects protocol-relative and backslash-smuggled URLs", () => {
    expect(safeRelativePath("//evil.com")).toBeNull();
    expect(safeRelativePath("/" + "\\" + "evil.com")).toBeNull();
    expect(safeRelativePath("/" + "\\" + "/evil.com")).toBeNull();
  });

  it("rejects absolute URLs and non-paths", () => {
    expect(safeRelativePath("https://evil.com")).toBeNull();
    expect(safeRelativePath("http://evil.com")).toBeNull();
    expect(safeRelativePath("javascript:alert(1)")).toBeNull();
    expect(safeRelativePath("evil.com")).toBeNull();
    expect(safeRelativePath("dashboard")).toBeNull();
  });

  it("rejects control-character smuggling past the leading slash", () => {
    expect(safeRelativePath("/" + TAB + "evil.com")).toBeNull();
    expect(safeRelativePath("/" + NEWLINE + "evil.com")).toBeNull();
    expect(safeRelativePath("/" + NUL + "evil")).toBeNull();
    expect(safeRelativePath("/" + DEL + "evil")).toBeNull();
  });
});
