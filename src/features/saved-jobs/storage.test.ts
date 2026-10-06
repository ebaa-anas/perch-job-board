import { afterEach, describe, expect, it, vi } from "vitest";

import { readSavedIds, writeSavedIds } from "@/features/saved-jobs/storage";

function stubLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
  vi.stubGlobal("window", { localStorage });
  return localStorage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readSavedIds", () => {
  it("returns an empty array when there is no window (server)", () => {
    expect(readSavedIds()).toEqual([]);
  });

  it("returns an empty array when nothing is stored", () => {
    stubLocalStorage();
    expect(readSavedIds()).toEqual([]);
  });

  it("returns the stored string ids", () => {
    const localStorage = stubLocalStorage();
    localStorage.setItem("perch-saved-jobs", JSON.stringify(["a", "b"]));
    expect(readSavedIds()).toEqual(["a", "b"]);
  });

  it("falls back to an empty array for malformed JSON", () => {
    const localStorage = stubLocalStorage();
    localStorage.setItem("perch-saved-jobs", "{not json");
    expect(readSavedIds()).toEqual([]);
  });

  it("falls back to an empty array when the stored value isn't an array", () => {
    const localStorage = stubLocalStorage();
    localStorage.setItem("perch-saved-jobs", JSON.stringify({ a: 1 }));
    expect(readSavedIds()).toEqual([]);
  });

  it("drops non-string entries from a stored array", () => {
    const localStorage = stubLocalStorage();
    localStorage.setItem("perch-saved-jobs", JSON.stringify(["a", 1, null, "b"]));
    expect(readSavedIds()).toEqual(["a", "b"]);
  });
});

describe("writeSavedIds", () => {
  it("is a no-op when there is no window (server)", () => {
    expect(() => writeSavedIds(["a"])).not.toThrow();
  });

  it("persists ids so a subsequent read sees them", () => {
    stubLocalStorage();
    writeSavedIds(["a", "b"]);
    expect(readSavedIds()).toEqual(["a", "b"]);
  });
});
